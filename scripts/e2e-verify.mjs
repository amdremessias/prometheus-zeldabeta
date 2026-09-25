import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://zelda:zelda@localhost:5444/zeldapdv' });
(async () => {
  const r = await pool.query(`SELECT c.id chat, c.phone, c.customer_name, c.subject, c.status, c.conversation_status,
    pw.id pedido, pw.status pedido_status, pw.status_entrega, pw.recebido
    FROM chat_wpp c JOIN pedidos_web pw ON pw.ticket_id = c.ticket_id
    WHERE c.phone IN ('5511980010001','5511980010002','5511980010003') ORDER BY c.id`);
  for (const row of r.rows) {
    console.log(`#${row.chat} ${row.customer_name} (${row.phone}) | chat=${row.status}/${row.conversation_status} | pedido #${row.pedido} status=${row.pedido_status} entrega=${row.status_entrega} recebido=${row.recebido}`);
  }
  console.log('total tickets:', r.rowCount);
  await pool.end();
})();
