import { pool, ensureSchema } from './db';

export interface CaixaRow {
    id: number;
    status: 'aberto' | 'fechado';
    opened_at: Date;
    opened_by: number | null;
    initial_amount: string;
    closed_at: Date | null;
    closed_by: number | null;
    expected_amount: string | null;
    final_amount: string | null;
    difference: string | null;
    sales_count: number | null;
    notes: string | null;
    detail: unknown | null;
}

export async function getOpenCaixa(): Promise<CaixaRow | null> {
    await ensureSchema();
    const res = await pool.query('SELECT * FROM caixa WHERE status = $1 ORDER BY id DESC LIMIT 1', ['aberto']);
    return res.rows[0] ?? null;
}

export async function getLastCaixa(): Promise<CaixaRow | null> {
    await ensureSchema();
    const res = await pool.query('SELECT * FROM caixa ORDER BY id DESC LIMIT 1');
    return res.rows[0] ?? null;
}

export async function abrirCaixa(userId: number, initialAmount: number): Promise<CaixaRow> {
    await ensureSchema();
    const res = await pool.query(
        `INSERT INTO caixa (status, opened_by, initial_amount) VALUES ($1, $2, $3) RETURNING *`,
        ['aberto', userId, initialAmount]
    );
    return res.rows[0];
}

export async function fecharCaixa(
    caixaId: number,
    userId: number,
    expectedAmount: number,
    finalAmount: number,
    salesCount: number,
    notes?: string,
    detail?: unknown
): Promise<CaixaRow> {
    await ensureSchema();
    const difference = finalAmount - expectedAmount;
    const res = await pool.query(
        `UPDATE caixa
         SET status = $1,
             closed_at = now(),
             closed_by = $2,
             expected_amount = $3,
             final_amount = $4,
             difference = $5,
             sales_count = $6,
             notes = $7,
             detail = $9
         WHERE id = $8 RETURNING *`,
        ['fechado', userId, expectedAmount, finalAmount, difference, salesCount, notes ?? null, caixaId, detail ?? null]
    );
    return res.rows[0];
}

export async function getCaixasHistorico(limit = 50): Promise<CaixaRow[]> {
    await ensureSchema();
    const res = await pool.query(
        'SELECT * FROM caixa WHERE status = $1 ORDER BY closed_at DESC, id DESC LIMIT $2',
        ['fechado', limit]
    );
    return res.rows;
}