# Rollback — Stack Zelda PDV (`zeldapdv`)

Este guia descreve como reverter a stack em produção. **Não há repositório git** neste
diretório — o código é construído diretamente em imagens Docker a partir do fonte local.
Portanto, o "rollback de código" é feito **sempre via tag de imagem anterior** e o
"rollback de dados" é feito **restaurando o volume do Postgres** (ou um dump).

Stack (compose: `docker-compose-zeldapdv.yml`):

| Serviço            | Container                     | Imagem / Volume                                  |
|--------------------|-------------------------------|--------------------------------------------------|
| Postgres           | `restaurante-zeldapdv-postgres` | `postgres:16-alpine` / volume `restaurante_zeldapdv_pgdata` |
| CRM (Next.js)      | `restaurante-zeldapdv-crm`      | build local → `restaurante-tech-main-zeldapdv-crm-zeldapdv` |
| WAHA               | `restaurante-zeldapdv-waha`     | `devlikeapro/waha:latest` / `restaurante_zeldapdv_waha_sessions` |
| n8n                | `restaurante-zeldapdv-n8n`      | `n8nio/n8n:2.33.7` / `restaurante_zeldapdv_n8n_data` |
| Backups            | —                             | volume `restaurante_zeldapdv_backups` (`/backups`) |

Host ports: CRM `3013`, WAHA `3012`, n8n `5688`, Postgres `5444`.

---

## 0. Prática recomendada (faça ANTES de cada deploy)

Marque a imagem atual do CRM antes de reconstruir, para ter sempre um ponto de retorno:

```powershell
# No host, no diretório do projeto
$tag = "rollback-" + (Get-Date -Format "yyyyMMdd-HHmm")
docker tag restaurante-tech-main-zeldapdv-crm-zeldapdv:latest "restaurante-tech-main-zeldapdv-crm-zeldapdv:$tag"
docker image ls --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" | findstr crm-zeldapdv
```

E gere um dump do banco como "snapshot pré-deploy":

```powershell
$env:PGPASSWORD = "zelda"
$arq = ".\backups\pre-deploy-$(Get-Date -Format yyyyMMdd-HHmm).sql"
docker exec -i restaurante-zeldapdv-postgres pg_dump -U zelda -d zeldapdv -F p > $arq
```

> O diretório `.\backups` (no host) pode ser montado no volume `/backups` do CRM, ou
> simplesmente mantido no host. Guarde esses arquivos fora do container.

---

## 1. Rollback de CÓDIGO (CRM / telas / fluxo de pedidos)

Se uma atualização do CRM quebrar algo, volte para a imagem tagueada anterior:

```powershell
# 1) pare e remova o container atual do CRM
docker compose -f docker-compose-zeldapdv.yml stop crm-zeldapdv
docker compose -f docker-compose-zeldapdv.yml rm -f crm-zeldapdv

# 2) aponte o serviço para a imagem de rollback (substitua pela tag desejada)
docker tag "restaurante-tech-main-zeldapdv-crm-zeldapdv:rollback-YYYYMMDD-HHMM" `
            restaurante-tech-main-zeldapdv-crm-zeldapdv:latest

# 3) soba novamente
docker compose -f docker-compose-zeldapdv.yml up -d crm-zeldapdv
```

Se não houver tag anterior, a única forma é reconstruir a partir de um fonte conhecido:
restaure o diretório de trabalho para a versão estável (cópia em
`D:\AIDir\restaurante-tech-main\restaurante-tech-main-zeldapdv\` ou backup externo) e rode:

```powershell
docker compose -f docker-compose-zeldapdv.yml up -d --build crm-zeldapdv
```

> O Postgres **não** precisa ser parado para rollback de código, a menos que a
> migração de schema aplicada seja incompatível com o código antigo (ver seção 3).

---

## 2. Rollback de BANCO DE DADOS (Postgres)

### 2a. Restaurar a partir de um dump (recomendado)

```powershell
$env:PGPASSWORD = "zelda"
# CUIDADO: isto apaga e recria o banco. Use apenas para voltar a um estado conhecido.
docker exec -i restaurante-zeldapdv-postgres psql -U zelda -d zeldapdv -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
Get-Content -Path ".\backups\pre-deploy-AAAAMMDD-HHMM.sql" -Raw | `
  docker exec -i restaurante-zeldapdv-postgres psql -U zelda -d zeldapdv
```

### 2b. Rollback completo do volume (volta TUDO, incluindo pedidos)

```powershell
docker compose -f docker-compose-zeldapdv.yml stop db-zeldapdv
docker compose -f docker-compose-zeldapdv.yml rm -f db-zeldapdv
docker volume rm restaurante_zeldapdv_pgdata
docker compose -f docker-compose-zeldapdv.yml up -d db-zeldapdv
# O CRM recria o schema (ensureSchema) na primeira requisição; o app_state voltará
# ao cardápio mínimo de fábrica (restauranteVazio).
```

---

## 3. Rollback de MIGRAÇÕES de SCHEMA incompatíveis

O CRM aplica migrações de forma idempotente em `ensureSchema()` (`src/lib/server/db.ts`,
bloco `MIGRATIONS_SQL`). Se um deploy novo adicionou colunas/constraints e você precisa
voltar o **código** sem perder dados, normalmente **não é necessário** reverter o schema,
pois as colunas novas são ignoradas pelo código antigo.

Caso precise remover colunas adicionadas (ex.: o grupo `status_entrega`/entrega), rode
manualmente no banco:

```powershell
$env:PGPASSWORD = "zelda"
docker exec -i restaurante-zeldapdv-postgres psql -U zelda -d zeldapdv -c @"
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS status_entrega;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS entregador;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS entregador_telefone;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS observacoes;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS carteira_fiado;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS recebido;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS retirada_confirmada_at;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS saiu_entrega_at;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS entregue_at;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS recebido_at;
ALTER TABLE pedidos_web DROP COLUMN IF EXISTS updated_at;
DROP TABLE IF EXISTS clientes_carteira_fiado;
DROP TABLE IF EXISTS carteira_fiado_movimentos;
"@
```

> Faça isso **apenas** se tiver certeza de que nenhum código em produção usa essas colunas.

---

## 4. Rollback do n8n (agente Gemini)

O workflow "ZeldaPDV - Agente Gemini" vive no n8n. Para voltar uma versão:

1. Exporte o workflow atual (n8n UI → Workflow → Export) e guarde como backup.
2. Importe o JSON da versão estável (ex.: `n8n/workflows/...`) e **publique**
   (`n8n publish:workflow --id=<id>` + reinicie o n8n se necessário).

Para descartar todas as alterações do n8n e voltar ao estado do volume:

```powershell
docker compose -f docker-compose-zeldapdv.yml stop n8n-zeldapdv
docker compose -f docker-compose-zeldapdv.yml rm -f n8n-zeldapdv
docker volume rm restaurante_zeldapdv_n8n_data
docker compose -f docker-compose-zeldapdv.yml up -d n8n-zeldapdv
# Reimporte e republique o workflow estável.
```

---

## 5. Rollback "nuclear" (reset total da stack)

```powershell
docker compose -f docker-compose-zeldapdv.yml down
docker volume rm restaurante_zeldapdv_pgdata restaurante_zeldapdv_waha_sessions `
                    restaurante_zeldapdv_n8n_data restaurante_zeldapdv_backups
docker compose -f docker-compose-zeldapdv.yml up -d --build
```

---

## 6. Variáveis de ambiente (.env)

Nenhuma variável crítica de rollback é versionada em git. Mantenha um `.env` de backup
em local seguro. Valores padrão (se faltarem): `JWT_SECRET=dev-secret-zeldapdv`,
`ADMIN_EMAIL=adm@zeldapdv.lab`, `ADMIN_PASSWORD=admin123`,
`CRM_WEBHOOK_SECRET=e6bfc7bb3eeb4759bac3ffaf7b09636b`.

---

## Resumo rápido

| O que quebrar | Comando-resumo |
|---------------|----------------|
| Tela/CRM | `docker tag ...:rollback-XXXX crm-zeldapdv:latest` + `up -d crm-zeldapdv` |
| Dados do dia | restaurar dump `pg_dump`/`psql` (seção 2a) |
| Tudo (dados+config) | remover volume `restaurante_zeldapdv_pgdata` (seção 2b) |
| Agente IA | reimportar JSON estável do n8n (seção 4) |
