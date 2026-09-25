import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || (isProd ? '' : 'adm@zeldapdv.lab');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isProd ? '' : 'admin123');

const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL || 'postgresql://zelda:zelda@localhost:5432/zeldapdv',
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_state (
    id INT PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);
CREATE TABLE IF NOT EXISTS caixa (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('aberto', 'fechado')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_by INT REFERENCES users(id),
    initial_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closed_at TIMESTAMPTZ,
    closed_by INT REFERENCES users(id),
    expected_amount NUMERIC(12, 2),
    final_amount NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    sales_count INT,
    notes TEXT,
    detail JSONB
);
CREATE TABLE IF NOT EXISTS pedidos_web (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL,
    cliente TEXT NOT NULL,
    telefone TEXT NOT NULL,
    endereco TEXT NOT NULL DEFAULT '',
    pagamento TEXT NOT NULL,
    taxa_entrega_nome TEXT NOT NULL DEFAULT '',
    taxa_entrega_valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    itens JSONB NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    modo_entrega TEXT NOT NULL DEFAULT 'retirada',
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_preparo', 'concluido', 'cancelado')),
    status_entrega TEXT NOT NULL DEFAULT 'aguardando' CHECK (status_entrega IN ('aguardando', 'retirada_confirmada', 'em_entrega', 'entregue', 'recebido')),
    entregador TEXT NOT NULL DEFAULT '',
    entregador_telefone TEXT NOT NULL DEFAULT '',
    observacoes TEXT NOT NULL DEFAULT '',
    carteira_fiado BOOLEAN NOT NULL DEFAULT FALSE,
    recebido BOOLEAN NOT NULL DEFAULT FALSE,
    retirada_confirmada_at TIMESTAMPTZ,
    saiu_entrega_at TIMESTAMPTZ,
    entregue_at TIMESTAMPTZ,
    recebido_at TIMESTAMPTZ,
    faturado BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/* Garante o schema de atendimento humano (idempotente em novos deploys; a
   migration SQL zeldapdv_integration_migration.sql faz o mesmo em bases legadas). */
const CHAT_WPP_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS chat_wpp (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    last_message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','assumido','finalizado')),
    assigned_to INTEGER REFERENCES users(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ticket_id TEXT NOT NULL DEFAULT '',
    ticket_key TEXT,
    waha_chat_id TEXT,
    phone_normalized TEXT,
    channel TEXT NOT NULL DEFAULT 'waha',
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_wpp_ticket_key_uidx ON chat_wpp(ticket_key) WHERE ticket_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_wpp_open_idx ON chat_wpp(status, updated_at);
CREATE TABLE IF NOT EXISTS chat_wpp_messages (
    id BIGSERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES chat_wpp(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','human','automation','system')),
    text TEXT NOT NULL,
    waha_message_id TEXT,
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','delivered','failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_wpp_messages_waha_uidx ON chat_wpp_messages(waha_message_id) WHERE waha_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_wpp_messages_ticket_idx ON chat_wpp_messages(ticket_id, created_at);
`;

/* Migrações idempotentes para bases já existentes. */
const MIGRATIONS_SQL = [
    CHAT_WPP_SCHEMA_SQL,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS ticket_id TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'waha';`,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS waha_chat_id TEXT;`,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS phone_normalized TEXT;`,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;`,
    `CREATE INDEX IF NOT EXISTS chat_wpp_ticket_idx ON chat_wpp(ticket_id);`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS ticket_id TEXT NOT NULL DEFAULT '';`,
    `CREATE INDEX IF NOT EXISTS pedidos_web_ticket_idx ON pedidos_web(ticket_id);`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS modo_entrega TEXT NOT NULL DEFAULT 'retirada';`,
    `ALTER TABLE caixa ADD COLUMN IF NOT EXISTS detail JSONB;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS faturado BOOLEAN NOT NULL DEFAULT FALSE;`,
    // Permite cancelar pedidos do Cardápio Digital (atômico e concorrência-safe).
    `DO $$ BEGIN
        LOCK TABLE pedidos_web IN ACCESS EXCLUSIVE MODE;
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'pedidos_web'::regclass AND conname = 'pedidos_web_status_check'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'pedidos_web'::regclass AND conname = 'pedidos_web_status_check'
                  AND pg_get_constraintdef(oid) LIKE '%cancelado%'
            ) THEN
                ALTER TABLE pedidos_web DROP CONSTRAINT pedidos_web_status_check;
                ALTER TABLE pedidos_web ADD CONSTRAINT pedidos_web_status_check
                    CHECK (status IN ('pendente', 'em_preparo', 'concluido', 'cancelado'));
            END IF;
        ELSE
            ALTER TABLE pedidos_web ADD CONSTRAINT pedidos_web_status_check
                CHECK (status IN ('pendente', 'em_preparo', 'concluido', 'cancelado'));
        END IF;
    END $$;`,
    // Colunas do módulo de Entrega (status_entrega e ciclo de entrega/pickup).
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS status_entrega TEXT NOT NULL DEFAULT 'aguardando' CHECK (status_entrega IN ('aguardando', 'retirada_confirmada', 'em_entrega', 'entregue', 'recebido'));`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS entregador TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS entregador_telefone TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS observacoes TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS carteira_fiado BOOLEAN NOT NULL DEFAULT FALSE;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS recebido BOOLEAN NOT NULL DEFAULT FALSE;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS retirada_confirmada_at TIMESTAMPTZ;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS saiu_entrega_at TIMESTAMPTZ;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS entregue_at TIMESTAMPTZ;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS recebido_at TIMESTAMPTZ;`,
    `ALTER TABLE pedidos_web ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`,
    // Carteira/Fiado usada na entrega com pagamento fiado (referenciada por /api/entregas).
    `CREATE TABLE IF NOT EXISTS clientes_carteira_fiado (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        habilitado BOOLEAN NOT NULL DEFAULT TRUE,
        limite NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS carteira_fiado_movimentos (
        id BIGSERIAL PRIMARY KEY,
        pedido_id INTEGER,
        cliente TEXT NOT NULL DEFAULT '',
        telefone TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('debito','credito')),
        valor NUMERIC(12,2) NOT NULL DEFAULT 0,
        recebido BOOLEAN NOT NULL DEFAULT FALSE,
        observacao TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Tabela clients (canônica de clientes WhatsApp) + FK em chat_wpp (state machine).
    `CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL DEFAULT '',
        telefone TEXT NOT NULL DEFAULT '',
        telefone_normalizado TEXT,
        email TEXT NOT NULL DEFAULT '',
        endereco TEXT NOT NULL DEFAULT '',
        observacao TEXT NOT NULL DEFAULT '',
        carteira_habilitada BOOLEAN NOT NULL DEFAULT FALSE,
        saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
        origem TEXT NOT NULL DEFAULT 'whatsapp',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS clients_telefone_norm_uidx ON clients(telefone_normalizado) WHERE telefone_normalizado IS NOT NULL AND telefone_normalizado <> '';`,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clients(id);`,
    `ALTER TABLE chat_wpp ADD COLUMN IF NOT EXISTS conversation_status TEXT NOT NULL DEFAULT 'EM_IA' CHECK (conversation_status IN ('EM_IA','EM_HUMANO','FINALIZADO'));`,
    `CREATE INDEX IF NOT EXISTS chat_wpp_phone_idx ON chat_wpp(phone);`,
    // Seed: migra clientes legados de app_state.data.clientes para a tabela clients.
    `INSERT INTO clients (nome, telefone, telefone_normalizado, origem)
        SELECT COALESCE(c->>'nome','Cliente'), c->>'telefone', regexp_replace(c->>'telefone','\\D','','g'), 'app_state'
        FROM jsonb_array_elements((SELECT data->'clientes' FROM app_state WHERE id = 1)) c
        WHERE c->>'telefone' IS NOT NULL AND regexp_replace(c->>'telefone','\\D','','g') <> ''
        ON CONFLICT (telefone_normalizado) WHERE telefone_normalizado IS NOT NULL AND telefone_normalizado <> '' DO NOTHING;`,
    // Tabela de feedback/SAC (elogios, reclamações) — referenciada por /api/whatsapp/feedback e /api/v1/sac/tickets.
    `CREATE TABLE IF NOT EXISTS feedback_pedidos_wpp (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT 'elogio',
        message TEXT NOT NULL DEFAULT '',
        order_number TEXT,
        status TEXT NOT NULL DEFAULT 'aberto',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // ── Módulo Fiscal (NFC-e / NF-e) ──────────────────────────────────────────────
    // Tabelas ADDITIVAS e não-destrutivas: não alteram tabelas existentes nem app_state.
    // Fase 1: apenas armazenamento (UI + Data Layer). Sem transmissão real para a SEFAZ.
    // Segredos (certificado .pfx, senha, CSC) ficam CRIPTOGRAFADOS em repouso (BYTEA/TEXT cipher).
    `CREATE TABLE IF NOT EXISTS fiscal_config (
        id SERIAL PRIMARY KEY,
        habilitado BOOLEAN NOT NULL DEFAULT FALSE,
        cnpj TEXT NOT NULL UNIQUE,
        razao_social TEXT NOT NULL,
        nome_fantasia TEXT NOT NULL DEFAULT '',
        ie TEXT NOT NULL DEFAULT '',
        crt TEXT NOT NULL DEFAULT '1',
        ambiente INT NOT NULL DEFAULT 2,
        certificado_nome TEXT NOT NULL DEFAULT '',
        certificado_pfx BYTEA,
        certificado_senha BYTEA,
        csc_token BYTEA,
        csc_id TEXT NOT NULL DEFAULT '',
        serie_nfce INT NOT NULL DEFAULT 1,
        serie_nfe INT NOT NULL DEFAULT 1,
        proximo_numero_nfce INT NOT NULL DEFAULT 1,
        proximo_numero_nfe INT NOT NULL DEFAULT 1,
        codigo_ibge_municipio TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Compatibilidade: garante a coluna habilitado mesmo em tabelas criadas sem ela.
    `ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS habilitado BOOLEAN NOT NULL DEFAULT FALSE;`,
    `CREATE TABLE IF NOT EXISTS fiscal_notes (
        id SERIAL PRIMARY KEY,
        pedido_id INT,
        venda_id TEXT NOT NULL DEFAULT '',
        modelo TEXT NOT NULL CHECK (modelo IN ('55','65')),
        serie INT NOT NULL,
        numero INT NOT NULL,
        chave_acesso TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'pendente'
            CHECK (status IN ('pendente','autorizada','rejeitada','cancelada','contingencia')),
        ambiente INT NOT NULL DEFAULT 2,
        xml_envio TEXT,
        xml_retorno TEXT,
        protocolo TEXT,
        motivo_rejeicao TEXT,
        payload_venda JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fiscal_notes_chave ON fiscal_notes(chave_acesso);`,
    `CREATE INDEX IF NOT EXISTS idx_fiscal_notes_status ON fiscal_notes(status);`,
    `CREATE INDEX IF NOT EXISTS idx_fiscal_notes_created ON fiscal_notes(created_at);`,
];

let initialized = false;

export async function ensureSchema(): Promise<void> {
    if (initialized) return;
    await pool.query(SCHEMA_SQL);
    for (const migration of MIGRATIONS_SQL) {
        await pool.query(migration);
    }
    initialized = true;
}

/* Cria o usuário admin padrão (idempotente) caso não exista. */
export async function ensureDefaultUser(): Promise<void> {
    await ensureSchema();
    if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
        if (isProd) {
            throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios em produção.');
        }
        console.warn('Seed de admin pulado: defina ADMIN_EMAIL/ADMIN_PASSWORD (modo dev).');
        return;
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [DEFAULT_ADMIN_EMAIL]);
    if ((existing.rowCount ?? 0) > 0) return;

    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
        'Administrador',
        DEFAULT_ADMIN_EMAIL,
        hash,
        'admin',
    ]);
}

export interface SafeUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

export async function findByEmail(email: string): Promise<{ id: number; name: string; email: string; passwordHash: string; role: string; active: boolean } | null> {
    await ensureSchema();
    const res = await pool.query(
        'SELECT id, name, email, password_hash AS "passwordHash", role, active FROM users WHERE email = $1',
        [email]
    );
    return res.rows[0] ?? null;
}

export interface UserRow {
    id: number;
    name: string;
    email: string;
    role: string;
    active: boolean;
    created_at: Date;
}

export async function listUsers(): Promise<UserRow[]> {
    await ensureSchema();
    const res = await pool.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY id ASC');
    return res.rows;
}

export async function getUserById(id: number): Promise<UserRow | null> {
    await ensureSchema();
    const res = await pool.query('SELECT id, name, email, role, active, created_at FROM users WHERE id = $1', [id]);
    return res.rows[0] ?? null;
}

export async function createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: string;
}): Promise<UserRow> {
    await ensureSchema();
    const res = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active, created_at',
        [data.name, data.email, data.passwordHash, data.role]
    );
    return res.rows[0];
}

export async function updateUser(
    id: number,
    data: { name?: string; email?: string; role?: string; active?: boolean }
): Promise<UserRow | null> {
    await ensureSchema();
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (current.rowCount === 0) return null;

    const row = current.rows[0];
    const res = await pool.query(
        `UPDATE users
         SET name = $2, email = $3, role = $4, active = $5
         WHERE id = $1
         RETURNING id, name, email, role, active, created_at`,
        [
            id,
            data.name ?? row.name,
            data.email ?? row.email,
            data.role ?? row.role,
            data.active !== undefined ? data.active : row.active,
        ]
    );
    return res.rows[0];
}

export async function updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await ensureSchema();
    await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

export async function getPasswordHashById(id: number): Promise<string | null> {
    await ensureSchema();
    const res = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
    return res.rows[0]?.password_hash ?? null;
}

/* Upsert de cliente na tabela clients (referência canônica para chat_wpp / state machine).
   Normaliza o telefone e atualiza dados quando já existe. */
export async function upsertClient(input: {
    nome?: string;
    telefone: string;
    email?: string;
    endereco?: string;
    observacao?: string;
    origem?: string;
}): Promise<{ id: number }> {
    await ensureSchema();
    const telefone = String(input.telefone ?? '').replace(/\D/g, '');
    if (!telefone) throw new Error('telefone inválido');
    const existing = await pool.query('SELECT id FROM clients WHERE telefone_normalizado = $1 LIMIT 1', [telefone]);
    if (existing.rowCount) {
        const id = existing.rows[0].id;
        await pool.query(
            `UPDATE clients
                SET nome = COALESCE(NULLIF($2, ''), nome),
                    email = COALESCE(NULLIF($3, ''), email),
                    endereco = COALESCE(NULLIF($4, ''), endereco),
                    observacao = COALESCE(NULLIF($5, ''), observacao),
                    updated_at = now()
              WHERE id = $1`,
            [id, input.nome || '', input.email || '', input.endereco || '', input.observacao || '']
        );
        return { id };
    }
    const res = await pool.query(
        `INSERT INTO clients (nome, telefone, telefone_normalizado, email, endereco, observacao, origem)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
            input.nome || 'Cliente',
            input.telefone,
            telefone,
            input.email || '',
            input.endereco || '',
            input.observacao || '',
            input.origem || 'whatsapp',
        ]
    );
    return { id: res.rows[0].id };
}

/* --- Cardápio Digital / pedidos web --- */

export async function getAppStateData(): Promise<unknown> {
    await ensureSchema();
    const res = await pool.query('SELECT data FROM app_state WHERE id = 1');
    return res.rows[0]?.data ?? null;
}

/* Upsert de cliente vindo do WhatsApp no app_state.data.clientes (fonte das telas Clientes/PDV).
   Retorna dados gravados para ecoar no fluxo do bot. */
export async function upsertClienteWhatsapp(input: { nome: string; telefone: string; endereco?: string; observacao?: string }): Promise<{ created: boolean; cliente: any; total: number }> {
    await ensureSchema();
    const telefone = String(input.telefone ?? '').replace(/\D/g, '');
    if (!telefone) throw new Error('telefone inválido');
    const currentRes = await pool.query('SELECT data FROM app_state WHERE id = 1');
    const data = (currentRes.rows[0]?.data ?? {}) as Record<string, any>;
    const clientes: any[] = Array.isArray(data.clientes) ? data.clientes : [];
    const existing = clientes.find((c) => String(c.telefone ?? '').replace(/\D/g, '') === telefone);
    let created = false;
    let cliente: any;
    if (existing) {
        cliente = {
            ...existing,
            nome: String(input.nome || existing.nome || 'Cliente'),
            telefone: String(existing.telefone ?? input.telefone),
            endereco: String(input.endereco ?? existing.endereco ?? ''),
            observacao: input.observacao ? String(input.observacao) : existing.observacao,
        };
        data.clientes = clientes.map((c) => (String(c.telefone ?? '').replace(/\D/g, '') === telefone ? cliente : c));
        await pool.query('UPDATE app_state SET data = $1::jsonb, updated_at = now() WHERE id = 1', [JSON.stringify(data)]);
    } else {
        const nextId = clientes.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
        cliente = {
            id: nextId,
            nome: String(input.nome || 'Cliente'),
            telefone: String(input.telefone),
            email: '',
            endereco: String(input.endereco ?? ''),
            observacao: input.observacao ? String(input.observacao) : undefined,
            carteiraHabilitada: false,
            saldo: 0,
            createdAt: new Date().toISOString(),
            movimentacoes: [],
        };
        data.clientes = [...clientes, cliente];
        await pool.query('UPDATE app_state SET data = $1::jsonb, updated_at = now() WHERE id = 1', [JSON.stringify(data)]);
        created = true;
    }
    return { created, cliente, total: data.clientes.length };
}

export interface PedidoWebRow {
    id: number;
    slug: string;
    cliente: string;
    telefone: string;
    endereco: string;
    observacoes?: string;
    modoEntrega?: string;
    carteiraFiado?: boolean;
    pagamento: string;
    taxa_entrega_nome: string;
    taxa_entrega_valor: number | string;
    itens: { id: number; title: string; price: number; quantity: number; notes?: string; adicionais?: { id: number; descricao: string; valor: number }[] }[];
    subtotal: number | string;
    total: number | string;
    status: string;
    faturado: boolean;
    created_at: Date;
}

export async function createPedidoWeb(data: {
    slug: string;
    cliente: string;
    telefone: string;
    endereco: string;
    observacoes?: string;
    modoEntrega?: string;
    origem?: string;
    carteiraFiado?: boolean;
    pagamento: string;
    taxaEntregaNome: string;
    taxaEntregaValor: number;
    itens: { id: number; title: string; price: number; quantity: number; notes?: string; adicionais?: { id: number; descricao: string; valor: number }[] }[];
    subtotal: number;
    total: number;
    ticketId?: string;
}): Promise<PedidoWebRow> {
    await ensureSchema();
    const res = await pool.query(
        `INSERT INTO pedidos_web (slug, cliente, telefone, endereco, observacoes, pagamento, taxa_entrega_nome, taxa_entrega_valor, itens, subtotal, total, modo_entrega, status_entrega, origem, ticket_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
            data.slug,
            data.cliente,
            data.telefone,
            data.endereco,
            data.observacoes || '',
            data.pagamento,
            data.taxaEntregaNome,
            data.taxaEntregaValor,
            JSON.stringify(data.itens),
            data.subtotal,
            data.total,
            data.modoEntrega || 'retirada',
            'aguardando',
            data.origem || '',
            data.ticketId || '',
        ]
    );
    return res.rows[0];
}

export async function listPedidosWeb(status?: string): Promise<PedidoWebRow[]> {
    await ensureSchema();
    const res = status
        ? await pool.query('SELECT * FROM pedidos_web WHERE status = $1 ORDER BY id DESC', [status])
        : await pool.query('SELECT * FROM pedidos_web ORDER BY id DESC');
    return res.rows;
}

export async function updatePedidoWebStatus(id: number, status: 'pendente' | 'em_preparo' | 'concluido' | 'cancelado'): Promise<boolean> {
    await ensureSchema();
    const res = await pool.query('UPDATE pedidos_web SET status = $2 WHERE id = $1', [id, status]);
    return (res.rowCount ?? 0) > 0;
}

/* Pedidos web concluídos ainda não faturados (entram no fechamento do caixa). */
export async function listPedidosWebConcluidosNaoFaturados(): Promise<PedidoWebRow[]> {
    await ensureSchema();
    const res = await pool.query(
        "SELECT * FROM pedidos_web WHERE status = 'concluido' AND faturado = FALSE ORDER BY id ASC"
    );
    return res.rows;
}

export async function marcarPedidosWebFaturados(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await ensureSchema();
    await pool.query('UPDATE pedidos_web SET faturado = TRUE WHERE id = ANY($1)', [ids]);
}

export { pool, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD };
