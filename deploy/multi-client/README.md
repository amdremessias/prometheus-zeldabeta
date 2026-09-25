# Deploy multi-cliente (um stack por cliente)

Modelo de escala em que **cada cliente é uma stack Docker isolada** (app + Postgres) servida pelo nginx do host via subdomínio wildcard.

```
xclient.internal.lab ──► nginx ──► 127.0.0.1:30101 ──► stack do xclient (app + postgres)
yclient.internal.lab ──► nginx ──► 127.0.0.1:30102 ──► stack do yclient (app + postgres)
wclient.internal.lab ──► nginx ──► 127.0.0.1:30103 ──► stack do wclient (app + postgres)
```

- **Isolamento**: rede e banco por cliente; credenciais (JWT/ADMIN/DB) únicas geradas random.
- **White label**: imagem `zeldapdv:<cliente>` construída com os `NEXT_PUBLIC_*` do cliente.
- **Escala**: cada cliente novo = `add-client.sh` (não toca nos existentes).
- **TLS**: wildcard `*.internal.lab` autoassinado (lab interno).

## Requisitos (Linux / VPS)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 openssl nginx curl
sudo usermod -aG docker "$USER"     # reabra a sessão para aplicar
```

## Fluxo

```bash
# 1x por VPS — estrutura, wildcard e nginx
./deploy/multi-client/install.sh

# por cliente novo (build ~1-2min com cache)
./deploy/multi-client/add-client.sh xclient
./deploy/multi-client/add-client.sh loja-norte --brand-name "Loja Norte" --brand-color "#0ea5e9"

# suporte
./deploy/multi-client/list-clients.sh                # estado de todos
./deploy/multi-client/backup-client.sh xclient       # pg_dump → backups/xclient/
./deploy/multi-client/remove-client.sh xclient       # preserva dados; --purge apaga
```

Certifique-se de que o DNS wildcard aponta para o IP da VPS:

```text
*.internal.lab   IN   A   <IP da VPS>
```

## O que cada script faz

| Comando | Descrição |
|---------|-----------|
| `install.sh` | cria `clients/` + `backups/`, gera wildcard `*.$WILDCARD_DOMAIN` em `/etc/nginx/ssl/`, garante o diretório de sites do nginx |
| `add-client.sh <c> [flags]` | idempotente: aloca porta (registry), gera `.env` com segredos únicos (no 1º run), gera compose, sobe stack (`docker compose -p <c> up -d --build`), cria conf do nginx e recarrega |
| `remove-client.sh <c> [--purge]` | derruba stack, remove conf nginx e entrada do registry; `--purge` apaga também o volume do banco |
| `backup-client.sh <c>` | `pg_dump` comprimido em `backups/<c>/pgdump-<ts>.sql.gz` |
| `list-clients.sh` | tabela cliente × porta × URL × estado do container |

## Variáveis de ambiente (todas opcionais)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WILDCARD_DOMAIN` | `internal.lab` | domínio base (`<cliente>.<domínio>`) |
| `NGINX_SITES` | `/etc/nginx/sites-enabled` | onde os confs de cliente são gravados |
| `CLIENTS_DIR` | `<repo>/clients` | pastas por cliente (`%env%/.env`, compose) |
| `BACKUPS_DIR` | `<repo>/deploy/multi-client/backups` | dumps por cliente |
| `HTTP_PORT`/`HTTPS_PORT` | `80`/`443` | portas do nginx |

## Branding por cliente

`--brand-name`, `--brand-description`, `--brand-logo`, `--brand-color`, `--brand-footer`. Sem flags, usa `.env` do repositório; senão, defaults. O branding é embutido no **build** — mudou a marca, refaça `add-client.sh` para o cliente.

## Licenciamento (dormante por padrão)

O módulo de licença (JWT Ed25519) já é provisionado em **todo cliente**, mas **desligado**: o `.env` de cada cliente traz `LICENSE_CLIENT_ID` já preenchido com o slug e `LICENSE_MASTER_PUBLIC_KEY`/`LICENSE_JWT` vazios. Enquanto a chave pública estiver vazia, o sistema não bloqueia nem pede licença (comportamento atual da VPS).

Para **habilitar no futuro**, por cliente (sem tocar nos demais):
1. Edite `clients/<cliente>/.env` e defina:
   - `LICENSE_MASTER_PUBLIC_KEY` — sua chave pública (a mesma em todas as instâncias).
   - `LICENSE_JWT` — token emitido via Master (`POST /api/license/generate`).
   - `LICENSE_DOMAIN` — ex.: `loja-norte.seudominio.com`.
2. Reexecute `./deploy/multi-client/add-client.sh <cliente>` para reconstruir.
3. Confira: `curl -fsS http://127.0.0.1:<porta>/api/license/status` → `licensing_enabled:true`.

A `LICENSE_MASTER_PRIVATE_KEY` **nunca** deve ir ao cliente — ela fica apenas na estação Master. Detalhes do módulo em [`../../LICENSING.md`](../../LICENSING.md) e rollback em [`../../ROLLBACK_LICENSING.md`](../../ROLLBACK_LICENSING.md).

## Notas

- A porta do app é publicada só em `127.0.0.1` (nginx acessa por loopback; não exposta na rede).
- Limites de memória/CPU por cliente em `clients/<c>/.env` (`CLIENT_MEM_LIMIT`, `CLIENT_CPU_LIMIT`).
- Rollback/recuperação em produção: ver [`../ROLLBACK.md`](../ROLLBACK.md).
- Vazamento de segredos: `clients/` e `backups/` estão no `.gitignore` e no `.dockerignore`.
- **Convivência com o stack único**: se mantiver o conf antigo do `deploy/deploy.sh` no mesmo nginx, remova o `ssl_session_cache shared:ZELDAPDV_SSL` dele (declarada uma única vez) ou use outro nginx — duas declarações da mesma zona fazem o `nginx -t` falhar com `duplicate zone`.