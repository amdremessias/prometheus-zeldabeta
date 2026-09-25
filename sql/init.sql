-- Schema do Zelda PDV
-- Executado automaticamente na primeira subida do container Postgres
-- (e também de forma idempotente pela aplicação via ensureSchema).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estado da aplicação (white label: uma linha por implantação).
-- O JSON espera o formato ClientDataType (sem Blobs; imagens como dataURL).
CREATE TABLE IF NOT EXISTS app_state (
    id INT PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    CONSTRAINT single_row CHECK (id = 1)
);

-- Abertura/fechamento de caixa (obrigatório para registrar vendas).
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
    notes TEXT
);