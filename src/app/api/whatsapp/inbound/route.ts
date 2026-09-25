import { NextRequest, NextResponse } from 'next/server';
import { pool, createPedidoWeb, upsertClienteWhatsapp } from '@/lib/server/db';
import { loadAppMenu, MenuPublico } from '@/lib/server/cardapioDigital';
import { openOrUpdateChatWpp, appendChatMessage, sendWahaMessageTo } from '@/lib/server/atendimento';
import { geminiEnabled, GeminiDecision } from '@/lib/server/gemini';
import { interpretWithFallback } from '@/lib/server/aiClient';

const getSecret = () => process.env.ZELDAPDV_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const makeTicket = () => `ZP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(100000 + Math.random() * 900000)}`;
const cleanPhone = (value: unknown) => String(value ?? '').replace(/@(c\.us|lid)$/i, '').trim();

function extractEvent(body: any) {
  const rawRoot = body?.raw && typeof body.raw === 'object' ? body.raw : body;
  const eventBody = rawRoot?.body && typeof rawRoot.body === 'object' ? rawRoot.body : rawRoot;
  const source = eventBody?.payload && typeof eventBody.payload === 'object' ? { ...eventBody, ...eventBody.payload } : eventBody;
  const metadata = source?._data && typeof source._data === 'object' ? source._data : {};
  const rawChatId = String(source?.chatId || source?.chat_id || source?.from || source?.to || body?.chatId || body?.chat_id || body?.phone || '').trim();
  const lid = String(metadata?.lid || source?.lid || body?.waha_lid || '').trim();
  const chatId = lid || rawChatId;
  const phone = String(body?.phone || source?.phone || rawChatId || chatId).replace(/@(c\.us|lid)$/i, '').trim();
  const text = String(body?.text || source?.text || source?.message || source?.body || '').trim();
  const eventId = String(body?.event_id || body?.eventId || eventBody?.id || body?.id || `${phone}:${Date.now()}`);
  return { phone, text, eventId, chatId, lid };
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      phone TEXT PRIMARY KEY,
      channel TEXT NOT NULL DEFAULT 'waha',
      state TEXT NOT NULL DEFAULT 'MENU',
      context JSONB NOT NULL DEFAULT '{}'::jsonb,
      human_active BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS waha_chat_id TEXT;
    ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS waha_lid TEXT;
    ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS phone_normalized TEXT;
    ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS last_event_id TEXT;
    CREATE TABLE IF NOT EXISTS whatsapp_inbound_events (
      event_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function formatMoeda(v: number) {
  return 'R$ ' + v.toFixed(2).replace('.', ',');
}

function formatCardapio(menu: MenuPublico) {
  const categorias = menu.categorias ?? [];
  const labelPorId = new Map(categorias.map((c) => [Number(c.id), c.label]));
  const linhas = menu.pratos.length
    ? menu.pratos
        .map((p) => {
          const cats = (p.category ?? [])
            .map((id) => labelPorId.get(Number(id)) || String(id))
            .filter(Boolean)
            .join(', ');
          return `${p.id} - ${p.title}${cats ? ` (${cats})` : ''} - ${formatMoeda(Number(p.price) || 0)}`;
        })
        .join('\n')
    : 'Nenhum item disponível no momento.';
  const taxa = menu.taxasEntrega[0];
  const entrega = taxa ? `\n\nEntrega (${taxa.nome}): ${formatMoeda(Number(taxa.valor) || 0)}` : '';
  return `*${menu.restaurantName || 'Cardápio'}*\n\n${linhas}${entrega}\n\nPara pedir: enviar *código x quantidade* (ex.: 1x2, 2x1)`;
}

function parseItens(text: string) {
  const itens: { id: number; quantity: number }[] = [];
  const re = /(\d{1,6})\s*[xX]\s*(\d{1,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) itens.push({ id: Number(m[1]), quantity: Number(m[2]) });
  const agg = new Map<number, number>();
  for (const i of itens) agg.set(i.id, Math.min(Math.max((agg.get(i.id) ?? 0) + i.quantity, 1), 50));
  return [...agg.entries()].map(([id, quantity]) => ({ id, quantity }));
}

/* Monta o carrinho validando os ids contra o cardápio (reaproveitado pela FSM e pelo agente). */
function buildCart(menu: MenuPublico, items: { id: number; quantity: number }[]) {
  const porId = new Map<number, any>(menu.pratos.map((p) => [Number(p.id), p]));
  const detalhes: { id: number; title: string; price: number; quantity: number }[] = [];
  let subtotal = 0;
  for (const item of items) {
    const prato = porId.get(Number(item.id));
    if (!prato) continue;
    const price = Number(prato.price) || 0;
    detalhes.push({ id: prato.id, title: prato.title, price, quantity: item.quantity });
    subtotal += price * item.quantity;
  }
  return { detalhes, subtotal };
}

function resumoCarrinho(carrinho: any) {
  const linhas = (carrinho.itens || []).map((d: any) => `${d.quantity}x ${d.title} - ${formatMoeda(d.price * d.quantity)}`).join('\n');
  const taxaValor = Number(carrinho.taxaValor) || 0;
  const taxaLinha = taxaValor > 0 ? `\nEntrega (${carrinho.taxaNome}): ${formatMoeda(taxaValor)}` : '';
  return { linhas, taxaValor, taxaLinha, subtotal: Number(carrinho.subtotal) || 0, total: Number(carrinho.total) || 0 };
}

export async function POST(req: NextRequest) {
  const expected = getSecret();
  const supplied = req.headers.get('x-zeldapdv-secret') ?? req.headers.get('x-crm-webhook-secret') ?? req.headers.get('x-wpp-inbound-token') ?? '';
  // WAHA (rede interna docker) não envia o header; exige secret apenas quando informado e divergente.
  if (expected && supplied && supplied !== expected) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { phone, text, eventId, chatId, lid } = extractEvent(body);
  const channel = body?.channel === 'cloud_api' ? 'cloud_api' : 'waha';
  if (!phone || !text) return NextResponse.json({ error: 'phone e text são obrigatórios' }, { status: 400 });

  await ensureSchema();
  const inserted = await pool.query(
    `INSERT INTO whatsapp_inbound_events(event_id, phone, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING RETURNING event_id`,
    [eventId, phone, JSON.stringify(body)],
  );
  if (!inserted.rowCount) return NextResponse.json({ ok: true, duplicate: true, phone, chat_id: chatId, human: false, text: '' });

  const currentResult = await pool.query('SELECT state, context, human_active FROM whatsapp_sessions WHERE phone = $1', [phone]);
  const current = currentResult.rows[0];
  const context: Record<string, unknown> = { ...(current?.context || {}), lastText: text, lastChatId: chatId, waha_lid: lid || undefined, lastEventId: eventId };
  let state = String(current?.state || 'MENU');
  let human = Boolean(current?.human_active);
  const wasHuman = human;
  let reply = '';
  let ticketId = String(context.ticket_id || '');

  if (!ticketId || state === 'FINALIZADO') {
    ticketId = makeTicket();
    context.ticket_id = ticketId;
    context.history = [];
    context.history_synced = 0;
    delete context.chat_id;
    state = 'MENU';
    human = false;
  }

  const value = normalize(text);
  const menuResult = await loadAppMenu();
  const menu = menuResult.ok ? menuResult.menu! : null;

  const MENU_MSG = `Olá! Bem-vindo ao ${menu?.restaurantName || 'Zelda PDV'} 🌿\n\nComo posso ajudar?\n\n1 — Fazer Pedido\n2 — Consultar Pedido\n3 — Ver Cardápio\n4 — Elogio ou Reclamação\n5 — Falar com Atendente`;

if (human) {
    reply = '';
  } else if (state === 'MENU') {
    /* Agente IA: entende linguagem natural além dos atalhos numéricos da FSM. */
    const ai = geminiEnabled && menu
      ? await interpretWithFallback({
          text,
          menu,
          history: Array.isArray(context.history) ? (context.history as { sender: 'customer' | 'automation'; text: string }[]) : [],
        })
      : null;
    const aiOrder = ai?.intent === 'order' && ai.items && ai.items.length > 0 && menu ? ai : null;
    if (aiOrder) {
      const m = menu!;
      const { detalhes, subtotal } = buildCart(m, aiOrder.items!);
      if (detalhes.length > 0) {
        context.cliente_nome = aiOrder.clienteNome || context.cliente_nome || 'Cliente';
        context.tipo_entrega = aiOrder.tipoEntrega || context.tipo_entrega || 'retirada';
        if (aiOrder.endereco) context.endereco = aiOrder.endereco;
        const entrega = context.tipo_entrega === 'entrega';
        const taxa = entrega && m.taxasEntrega?.length ? m.taxasEntrega[0] : null;
        const taxaValor = taxa ? Number(taxa.valor) || 0 : 0;
        const total = subtotal + taxaValor;
        const carrinho = { itens: detalhes, subtotal, taxaValor, taxaNome: taxa?.nome ?? '', total, entrega };
        context.carrinho = carrinho;
        if (aiOrder.pagamento) {
          context.pagamento = aiOrder.pagamento;
          state = 'CONFIRMACAO';
          const { linhas, taxaLinha, subtotal: sub, total: tot } = resumoCarrinho(carrinho);
          reply = `Confirma esse pedido?\n\n${linhas}\n\nSubtotal: ${formatMoeda(sub)}${taxaLinha}\n*Total: ${formatMoeda(tot)}*\n\nPagamento: *${aiOrder.pagamento}*\n\nResponda *sim* para confirmar ou *não* para refazer.`;
        } else {
          state = 'PAGAMENTO';
          const { linhas, taxaLinha, subtotal: sub, total: tot } = resumoCarrinho(carrinho);
          reply = `📋 *Resumo do pedido*\n\n${linhas}\n\nSubtotal: ${formatMoeda(sub)}${taxaLinha}\n*Total: ${formatMoeda(tot)}* (${entrega ? 'taxa de entrega já incluída' : 'retirada no local'})\n\n💳 Forma de pagamento? *pix*, *cartão*, *dinheiro* ou *carteira/fiado*.`;
        }
      } else {
        reply = aiOrder.reply || MENU_MSG;
      }
    } else if (ai?.intent === 'menu') {
      reply = menu ? formatCardapio(menu) : 'Cardápio indisponível no momento.';
    } else if (ai?.intent === 'status') {
      state = 'CONSULTA_PEDIDO';
      reply = 'Envie o número do pedido para consultar, ou *meu pedido* para ver o mais recente deste número.';
    } else if (ai?.intent === 'feedback') {
      state = 'FEEDBACK';
      reply = 'Envie seu elogio ou reclamação.';
    } else if (ai?.intent === 'human') {
      human = true;
      state = 'HUMANO';
      reply = ai.reply || '';
    } else if (ai?.intent === 'order' && ai.items?.length === 0) {
      state = 'TIPO_ENTREGA';
      reply = ai.reply || 'Seu pedido será para entrega ou retirada? Responda *entrega* ou *retirada*.';
    } else if (ai?.intent === 'reply' && ai.reply) {
      reply = `${ai.reply}\n\n${MENU_MSG}`;
    } else if (ai?.intent === 'clarify' && ai.reply) {
      reply = ai.reply;
    } else if (value === '1' || (value.includes('pedido') && !value.includes('status'))) {
      state = 'TIPO_ENTREGA';
      reply = 'Seu pedido será para entrega ou retirada? Responda *entrega* ou *retirada*.';
    } else if (value === '2' || value.includes('status') || value.includes('consultar')) {
      state = 'CONSULTA_PEDIDO';
      reply = 'Envie o número do pedido para consultar, ou *meu pedido* para ver o mais recente deste número.';
    } else if (value === '3' || value.includes('cardapio')) {
      reply = menu ? formatCardapio(menu) : 'Cardápio indisponível no momento.';
    } else if (value === '4' || value.includes('feedback') || value.includes('elogio') || value.includes('reclamacao')) {
      state = 'FEEDBACK';
      reply = 'Envie seu elogio ou reclamação.';
    } else if (value === '5' || value.includes('humano') || value.includes('atendente')) {
      human = true;
      state = 'HUMANO';
      reply = '';
    } else if (current) {
      reply = MENU_MSG;
    } else {
      reply = MENU_MSG;
    }
  } else if (state === 'TIPO_ENTREGA') {
    /* Agente IA: aceita respostas naturais como "quero entrega no endereço". */
    let aiTipo: GeminiDecision | null = null;
    if (geminiEnabled && menu && !value.includes('entrega') && !value.includes('retirada') && !value.includes('delivery') && !value.includes('balcao') && !value.includes('local')) {
      aiTipo = await interpretWithFallback({
        text,
        menu,
        history: Array.isArray(context.history) ? (context.history as { sender: 'customer' | 'automation'; text: string }[]) : [],
      });
      if (aiTipo?.tipoEntrega && aiTipo.intent !== 'clarify') context.tipo_entrega_ai = aiTipo.tipoEntrega;
    }
    const entrega = value.includes('entrega') || value === '1' || value.includes('delivery') || context.tipo_entrega_ai === 'entrega';
    const retirada = value.includes('retirada') || value === '2' || value.includes('balcao') || value.includes('local') || context.tipo_entrega_ai === 'retirada';
    if (!entrega && !retirada) {
      reply = 'Não entendi. Responda *entrega* ou *retirada*.';
    } else {
      context.tipo_entrega = entrega ? 'entrega' : 'retirada';
      delete context.endereco;
      delete context.cliente_cadastrado;
      state = 'DADOS_CLIENTE';
      reply = 'Qual o seu nome completo? O telefone já foi identificado.';
    }
} else if (state === 'DADOS_CLIENTE') {
    context.cliente_nome = text;
    if (context.tipo_entrega === 'entrega') {
      state = 'DADOS_ENDERECO';
      reply = 'Qual o endereço para entrega? (rua, número, bairro e referência)';
    } else {
      await upsertClienteWhatsapp({ nome: text, telefone: cleanPhone(phone) }).catch(() => undefined);
      context.cliente_cadastrado = true;
      state = 'ITENS_PEDIDO';
      reply = menu ? `Ótimo! Qual é o seu pedido?\n\n${formatCardapio(menu)}` : 'Qual é o seu pedido? (formato: 1x2, 2x1)';
    }
  } else if (state === 'DADOS_ENDERECO') {
    context.endereco = text;
    await upsertClienteWhatsapp({
      nome: String(context.cliente_nome || 'Cliente'),
      telefone: cleanPhone(phone),
      endereco: text,
    }).catch(() => undefined);
    context.cliente_cadastrado = true;
    state = 'ITENS_PEDIDO';
    reply = menu ? `Perfeito! Qual é o seu pedido?\n\n${formatCardapio(menu)}` : 'Qual é o seu pedido? (formato: 1x2, 2x1)';
  } else if (state === 'ITENS_PEDIDO') {
    const itens = parseItens(text);
    /* Agente IA: entende pedidos em linguagem natural ("2 hambúrgueres e 1 coca"). */
    let aiItens: GeminiDecision | null = null;
    if (itens.length === 0 && geminiEnabled && menu) {
      aiItens = await interpretWithFallback({
        text,
        menu,
        history: Array.isArray(context.history) ? (context.history as { sender: 'customer' | 'automation'; text: string }[]) : [],
      });
      const aiItems = aiItens?.intent === 'order' && aiItens.items ? aiItens.items : [];
      if (aiItems.length > 0 && menu) {
        const { detalhes } = buildCart(menu, aiItems);
        if (detalhes.length > 0) {
          const entrega = String(context.tipo_entrega || '') === 'entrega';
          const taxa = entrega && menu.taxasEntrega?.length ? menu.taxasEntrega[0] : null;
          const taxaValor = taxa ? Number(taxa.valor) || 0 : 0;
          const subtotal = detalhes.reduce((acc, d) => acc + d.price * d.quantity, 0);
          const total = subtotal + taxaValor;
          context.carrinho = { itens: detalhes, subtotal, taxaValor, taxaNome: taxa?.nome ?? '', total, entrega };
          state = 'PAGAMENTO';
          const { linhas, taxaLinha } = resumoCarrinho(context.carrinho);
          const r = resumoCarrinho(context.carrinho);
          reply = `📋 *Resumo do pedido*\n\n${linhas}\n\nSubtotal: ${formatMoeda(r.subtotal)}${taxaLinha}\n*Total: ${formatMoeda(r.total)}* (${entrega ? 'taxa de entrega já incluída' : 'retirada no local'})\n\n💳 Forma de pagamento? *pix*, *cartão*, *dinheiro* ou *carteira/fiado*.`;
        } else {
          reply = aiItens?.reply || 'Não encontrei esses itens no cardápio. Confira os códigos.';
        }
      } else if (aiItens && aiItens.reply && aiItens.intent !== 'clarify') {
        reply = aiItens.reply;
      }
    }
    if (state === 'PAGAMENTO') {
      /* tudo resolvido pelo agente acima */
    } else if (itens.length === 0 && !reply) {
      reply = menu ? `Não identifiquei o pedido. Envie no formato *código x quantidade* (ex.: 1x2, 2x1) ou descreva como "2 hambúrgueres e 1 refrigerante".\n\n${formatCardapio(menu)}` : 'Envie o pedido no formato 1x2, 2x1 ou descreva os itens.';
    } else if (itens.length > 0) {
      if (!menu) {
        reply = 'Cardápio indisponível. Tente novamente em instantes.';
      } else {
        const { detalhes, subtotal } = buildCart(menu, itens);
        if (detalhes.length === 0) {
          reply = menu ? `Não encontrei esses itens no cardápio. Confira os códigos:\n\n${formatCardapio(menu)}` : 'Não encontrei esses itens no cardápio.';
        } else {
          const entrega = String(context.tipo_entrega || '') === 'entrega';
          const taxa = entrega && menu.taxasEntrega?.length ? menu.taxasEntrega[0] : null;
          const taxaValor = taxa ? Number(taxa.valor) || 0 : 0;
          const total = subtotal + taxaValor;
          context.carrinho = { itens: detalhes, subtotal, taxaValor, taxaNome: taxa?.nome ?? '', total, entrega };
          const linhas = detalhes.map((d) => `${d.quantity}x ${d.title} - ${formatMoeda(d.price * d.quantity)}`).join('\n');
          const taxaLinha = taxa ? `\nEntrega (${taxa.nome}): ${formatMoeda(taxaValor)}` : '';
          state = 'PAGAMENTO';
          reply = `📋 *Resumo do pedido*\n\n${linhas}\n\nSubtotal: ${formatMoeda(subtotal)}${taxaLinha}\n*Total: ${formatMoeda(total)}* (${entrega ? 'taxa de entrega já incluída' : 'retirada no local'})\n\n💳 Forma de pagamento? *pix*, *cartão*, *dinheiro* ou *carteira/fiado*.`;
        }
      }
    }
  } else if (state === 'PAGAMENTO') {
    const aceito = /pix/.test(value) || /cartao/.test(value) || /dinheiro/.test(value) || /carteira/.test(value) || /fiado/.test(value);
    if (!aceito) {
      reply = 'Pagamento não reconhecido. Responda *pix*, *cartão*, *dinheiro* ou *carteira/fiado*.';
    } else {
      context.pagamento = value.includes('fiado') || value.includes('carteira') ? 'carteira' : value.includes('pix') ? 'pix' : value.includes('cartao') ? 'cartao' : 'dinheiro';
      state = 'CONFIRMACAO';
      const { linhas, taxaLinha, subtotal, total } = resumoCarrinho(context.carrinho || {});
      reply = `Confirma esse pedido?\n\n${linhas}\n\nSubtotal: ${formatMoeda(subtotal)}${taxaLinha}\n*Total: ${formatMoeda(total)}*\n\nResponda *sim* para confirmar ou *não* para refazer.`;
    }
  } else if (state === 'CONFIRMACAO') {
    const sim = value === 'sim' || value.startsWith('sim') || value === 'confirmar';
    const nao = value === 'nao' || value === 'n' || value.startsWith('nao') || value === 'cancelar';
    if (!sim && !nao) {
      reply = 'Responda *sim* para confirmar ou *não* para refazer.';
    } else if (nao) {
      delete context.carrinho;
      delete context.pagamento;
      state = 'ITENS_PEDIDO';
      reply = 'Sem problema! Qual é o seu pedido? (formato: 1x2, 2x1)';
    } else {
      const carrinho = (context.carrinho as any) || {};
      const itens = carrinho.itens || [];
      if (!itens.length || !carrinho.total) {
        delete context.carrinho;
        state = 'ITENS_PEDIDO';
        reply = menu ? `Preciso do seu pedido ainda. Qual é o pedido?\n\n${formatCardapio(menu)}` : 'Qual é o seu pedido? (formato: 1x2, 2x1)';
      } else {
        const slug = String((context.slug as string) || '').trim() || 'whatsapp';
        let pedidoId: number | null = null;
        let created = false;
        try {
          const pedido = await createPedidoWeb({
            slug,
            cliente: String(context.cliente_nome || 'Cliente'),
            telefone: cleanPhone(phone),
            endereco: String(context.endereco || (carrinho.entrega ? 'A combinar' : 'Retirada no local')),
            pagamento: String(context.pagamento || 'pix'),
            taxaEntregaNome: String(carrinho.taxaNome || ''),
            taxaEntregaValor: Number(carrinho.taxaValor) || 0,
            itens: itens.map((d: any) => ({ id: Number(d.id), title: String(d.title), price: Number(d.price), quantity: Number(d.quantity) })),
            subtotal: Number(carrinho.subtotal) || 0,
            total: Number(carrinho.total) || 0,
            modoEntrega: carrinho.entrega ? 'entrega' : 'retirada',
            ticketId,
          });
          pedidoId = Number(pedido?.id) || null;
          if (pedidoId) {
            await pool.query('UPDATE pedidos_web SET modo_entrega = $1 WHERE id = $2', [carrinho.entrega ? 'entrega' : 'retirada', pedidoId]);
          }
          created = true;
        } catch (e) {
          created = false;
          reply = 'Não consegui registrar o pedido agora. Um atendente vai te chamar para finalizar. 🙏';
        }
        if (created && pedidoId) {
          context.pedido_id = pedidoId;
          context.resumo_enviado = true;
          const linhas = itens.map((d: any) => `${d.quantity}x ${d.title} - ${formatMoeda(d.price * d.quantity)}`).join('\n');
          const taxaValor = Number(carrinho.taxaValor) || 0;
          const subtotal = Number(carrinho.subtotal) || 0;
          const total = Number(carrinho.total) || 0;
          const taxaLinha = taxaValor > 0 ? `\nEntrega (${carrinho.taxaNome}): ${formatMoeda(taxaValor)}` : '';
          reply = `🎉 *Pedido #${pedidoId} registrado!*\n\n${linhas}\n\nSubtotal: ${formatMoeda(subtotal)}${taxaLinha}\n*Total com entrega: ${formatMoeda(total)}*\n*Sem taxa de entrega: ${formatMoeda(subtotal)}*\n\nStatus: 📝 aguardando confirmação.\n\nVou transferir seu atendimento para o nosso time humano para finalizar o pedido. 🙌`;
          human = true;
          state = 'HUMANO';
        }
      }
    }
  } else if (state === 'CONSULTA_PEDIDO') {
    const numero = /^\d+$/.test(value);
    let pedidoRow = null;
    try {
      if (numero) {
        const r = await pool.query('SELECT * FROM pedidos_web WHERE id = $1 ORDER BY id DESC LIMIT 1', [Number(value)]);
        pedidoRow = r.rows[0] ?? null;
      } else {
        const r = await pool.query('SELECT * FROM pedidos_web WHERE telefone = $1 ORDER BY id DESC LIMIT 1', [cleanPhone(phone)]);
        pedidoRow = r.rows[0] ?? null;
      }
    } catch {
      pedidoRow = null;
    }
    if (!pedidoRow) {
      reply = 'Não encontrei pedidos para essa consulta. Envie *meu pedido* para ver o mais recente, ou *1* para fazer um novo pedido.';
    } else {
      const statusMap: Record<string, string> = { pendente: '📝 aguardando confirmação', em_preparo: '🍳 em preparo', concluido: '✅ pronto', cancelado: '❌ cancelado' };
      const status = statusMap[String(pedidoRow.status)] || String(pedidoRow.status || 'pendente');
      const itensLinhas = (Array.isArray(pedidoRow.itens) ? pedidoRow.itens : []).map((i: any) => `  ${i.quantity}x ${i.title}`).join('\n');
      reply = `*Pedido #${pedidoRow.id}*\n${itensLinhas}\n\nStatus: ${status}\nTotal: ${formatMoeda(Number(pedidoRow.total) || 0)}\n\nPara fazer um novo pedido, envie *1*.`;
    }
    state = 'MENU';
  } else if (state === 'FEEDBACK') {
    context.feedback = text;
    reply = 'Obrigado pelo retorno! Vou encaminhar ao nosso time. 🙏';
    human = true;
    state = 'HUMANO';
  } else if (state === 'HUMANO') {
    human = true;
    reply = '';
  } else {
    reply = MENU_MSG;
  }

  /* Ao transferir para atendimento humano sem resposta definida, avisa o cliente. */
  if (human && !reply && !wasHuman) {
    reply = 'Claro! Vou te transferir para um de nossos atendentes humanos. 🙏';
  }

  /* O CRM é quem efetivamente envia a resposta ao cliente via WAHA
     (padrão teknos: n8n orquestra a IA, CRM executa o envio). */
  if (reply) {
    await sendWahaMessageTo(chatId || phone, reply).catch(() => undefined);
  }

  /* Histórico E2E do ticket: a automação e o cliente ficam registrados e são
     sincronizados no chat_wpp/chat_wpp_messages sempre que o atendimento é
     humano (handoff), reutilizando o MESMO ticket_id da FSM. */
  const historyRaw = Array.isArray(context.history) ? (context.history as { sender: 'customer' | 'automation'; text: string }[]) : [];
  const history = [...historyRaw];
  if (text) history.push({ sender: 'customer', text });
  if (reply) history.push({ sender: 'automation', text: reply });

  if (true) {
    try {
      const chatRow = await openOrUpdateChatWpp({
        phone,
        customerName: String(context.cliente_nome || '').trim() || undefined,
        ticketId,
        channel,
        subject: context.pedido_id ? `Pedido #${context.pedido_id}` : context.feedback ? 'Feedback' : 'Atendimento via WhatsApp',
        messageText: reply || text,
        wahaChatId: chatId,
        conversationStatus: human ? 'EM_HUMANO' : 'EM_IA',
        metadata: { ticket_id: ticketId, from_automation: true },
      });
      const syncedCount = Math.max(0, Number(context.history_synced) || 0);
      for (let i = syncedCount; i < history.length; i++) {
        await appendChatMessage(chatRow.id, {
          direction: history[i].sender === 'customer' ? 'inbound' : 'outbound',
          senderType: history[i].sender === 'customer' ? 'customer' : 'automation',
          text: history[i].text,
        });
      }
      context.history_synced = history.length;
      context.chat_id = chatRow.id;
    } catch {
      // Fallback: o histórico não bloqueia a resposta ao cliente.
    }
  }
  context.history = history;

  await pool.query(
    `INSERT INTO whatsapp_sessions(phone, channel, state, context, human_active, waha_chat_id, waha_lid, phone_normalized, version, last_event_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $1, 1, $8)
     ON CONFLICT(phone) DO UPDATE SET state=EXCLUDED.state, channel=EXCLUDED.channel, context=EXCLUDED.context, human_active=EXCLUDED.human_active, waha_chat_id=COALESCE(EXCLUDED.waha_chat_id, whatsapp_sessions.waha_chat_id), waha_lid=COALESCE(EXCLUDED.waha_lid, whatsapp_sessions.waha_lid), phone_normalized=EXCLUDED.phone_normalized, version=whatsapp_sessions.version+1, last_event_id=EXCLUDED.last_event_id, updated_at=now()`,
    [phone, channel, state, JSON.stringify(context), human, chatId || null, lid || null, eventId],
  );
  return NextResponse.json({ ok: true, phone, chat_id: chatId, waha_lid: lid || null, state, human, human_active: human, ticket_id: ticketId, text: reply, action: human ? (reply ? 'handoff_with_reply' : 'handoff') : 'reply', ticket: { id: ticketId, status: human ? 'aberto' : 'automatico' } });
}

export async function GET() { return NextResponse.json({ ok: true, route: 'whatsapp-inbound', model: 'teknos-compatible' }); }



