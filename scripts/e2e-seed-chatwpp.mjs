import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://zelda:zelda@localhost:5444/zeldapdv';
const pool = new Pool({ connectionString: DATABASE_URL });

const PHONES = ['5511980010001', '5511980010002', '5511980010003'];

async function getPratos() {
  const r = await pool.query(`SELECT data->'cardapio'->'pratos' AS pratos FROM app_state WHERE id = 1`);
  const pratos = (r.rows[0]?.pratos || []).filter((p) => p && p.id && p.title && p.price != null);
  if (pratos.length < 2) throw new Error('Cardápio sem itens suficientes para o seed.');
  return pratos;
}

function item(p, qty) {
  return { id: Number(p.id), title: String(p.title), price: Number(p.price), quantity: qty };
}

async function seed() {
  // Limpa seeds anteriores para tornar idempotente.
  await pool.query(`DELETE FROM chat_wpp_messages WHERE ticket_id IN (SELECT id FROM chat_wpp WHERE phone = ANY($1))`, [PHONES]);
  await pool.query(`DELETE FROM chat_wpp WHERE phone = ANY($1)`, [PHONES]);
  await pool.query(`DELETE FROM pedidos_web WHERE telefone = ANY($1)`, [PHONES]);
  await pool.query(`DELETE FROM whatsapp_sessions WHERE phone = ANY($1)`, [PHONES]);

  const pratos = await getPratos();
  const p1 = pratos[0];
  const p2 = pratos[1];
  const taxa = Number(pratos[0]?.price || 5);

  const contatos = [
    {
      phone: PHONES[0],
      nome: 'Ana Entrega',
      // Cenário 1: saiu da cozinha -> em entrega (aguardando andamento)
      pedido: { status: 'concluido', status_entrega: 'em_entrega', saiu_entrega_at: 'now()', entregue_at: null, recebido: false },
      timeline: [
        ['inbound', 'customer', 'Oi, quero fazer um pedido de dois lanches'],
        ['outbound', 'automation', '📋 Resumo do pedido enviado. Confirma com *sim*.'],
        ['inbound', 'customer', 'sim'],
        ['outbound', 'automation', '🎉 Pedido registrado! Vou transferir para um atendente. 🙌'],
      ],
    },
    {
      phone: PHONES[1],
      nome: 'Beto Cozinha',
      // Cenário 2: na cozinha aguardando conclusão
      pedido: { status: 'em_preparo', status_entrega: 'aguardando', saiu_entrega_at: null, entregue_at: null, recebido: false },
      timeline: [
        ['inbound', 'customer', 'Bom dia, gostaria de pedir um lanche'],
        ['outbound', 'automation', '📋 Resumo do pedido enviado. Confirma com *sim*.'],
        ['inbound', 'customer', 'sim'],
        ['outbound', 'automation', '🎉 Pedido registrado! Vou transferir para um atendente. 🙌'],
      ],
    },
    {
      phone: PHONES[2],
      nome: 'Carla Recebido',
      // Cenário 3: entregue aguardando recebimento/finalização
      pedido: { status: 'concluido', status_entrega: 'entregue', saiu_entrega_at: 'now()', entregue_at: 'now()', recebido: false },
      timeline: [
        ['inbound', 'customer', 'Quero pedir meu almoço por favor'],
        ['outbound', 'automation', '📋 Resumo do pedido enviado. Confirma com *sim*.'],
        ['inbound', 'customer', 'sim'],
        ['outbound', 'automation', '🎉 Pedido registrado! Vou transferir para um atendente. 🙌'],
        ['outbound', 'automation', '📦 Seu pedido foi ENTREGUE. Confirme o recebimento quando puder. 🙏'],
      ],
    },
  ];

  for (let i = 0; i < contatos.length; i++) {
    const c = contatos[i];
    const ticketId = `ZP-E2E-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${1000 + i}`;

    const itens = [item(p1, 1), item(p2, 1)];
    const subtotal = itens.reduce((s, d) => s + d.price * d.quantity, 0);
    const taxaValor = c.pedido.status_entrega === 'em_entrega' || c.pedido.status_entrega === 'entregue' ? taxa : 0;
    const total = subtotal + taxaValor;

    const pedidoRes = await pool.query(
      `INSERT INTO pedidos_web
        (slug, cliente, telefone, endereco, pagamento, taxa_entrega_nome, taxa_entrega_valor,
         itens, subtotal, total, modo_entrega, status, status_entrega, ticket_id,
         saiu_entrega_at, entregue_at, recebido, origem, created_at)
       VALUES ('whatsapp', $1, $2, $3, 'pix', 'Taxa de entrega', $4, $5::jsonb, $6, $7, 'entrega', $8, $9, $10,
         ${c.pedido.saiu_entrega_at || 'NULL'}, ${c.pedido.entregue_at || 'NULL'}, $11, 'whatsapp', now())
       RETURNING id`,
      [
        c.nome,
        c.phone,
        'Rua E2E, 100, Centro',
        taxaValor,
        JSON.stringify(itens),
        subtotal,
        total,
        c.pedido.status,
        c.pedido.status_entrega,
        ticketId,
        c.pedido.recebido,
      ],
    );
    const pedidoId = pedidoRes.rows[0].id;

    const chatRes = await pool.query(
      `INSERT INTO chat_wpp (phone, customer_name, subject, last_message, status, conversation_status, ticket_id, channel, phone_normalized, metadata)
       VALUES ($1, $2, $3, $4, 'aberto', 'EM_HUMANO', $5, 'waha', $1, $6::jsonb) RETURNING id`,
      [
        c.phone,
        c.nome,
        `Pedido #${pedidoId}`,
        c.timeline[c.timeline.length - 1][2],
        ticketId,
        JSON.stringify({ ticket_id: ticketId, from_automation: true, pedido_id: pedidoId }),
      ],
    );
    const chatId = chatRes.rows[0].id;

    for (const [direction, sender, text] of c.timeline) {
      await pool.query(
        `INSERT INTO chat_wpp_messages (ticket_id, direction, sender_type, text, delivery_status, metadata)
         SELECT id, $2, $3, $4, 'sent', '{}'::jsonb FROM chat_wpp WHERE id = $1`,
        [chatId, direction, sender, text],
      );
    }

    // Garante sessão WhatsApp coerente (estado humano, fora do MENU).
    await pool.query(
      `INSERT INTO whatsapp_sessions (phone, channel, state, context, human_active, waha_chat_id, phone_normalized, version, last_event_id)
       VALUES ($1, 'waha', 'HUMANO', $2::jsonb, TRUE, $1, $1, 1, 'e2e-seed')
       ON CONFLICT (phone) DO UPDATE SET state='HUMANO', human_active=TRUE, context=EXCLUDED.context, updated_at=now()`,
      [c.phone, JSON.stringify({ ticket_id: ticketId, pedido_id: pedidoId, lastText: '' })],
    );

    console.log(`✔ ${c.nome} (${c.phone}) -> chat #${chatId}, pedido #${pedidoId} [status=${c.pedido.status}, status_entrega=${c.pedido.status_entrega}]`);
  }
}

seed()
  .then(() => {
    console.log('\nSeed E2E concluído. 3 contatos criados no ChatWPP em estados distintos.');
    return pool.end();
  })
  .catch((e) => {
    console.error('Erro no seed E2E:', e);
    process.exit(1);
  });
