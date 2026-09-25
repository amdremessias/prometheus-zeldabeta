#!/usr/bin/env bash
# ============================================================================
#  Zelda PDV - aplica a atualização na VPS preservando o banco de dados.
#
#  Rodar DENTRO do diretório de deploy, após extrair o tarball estável:
#      tar -xzf zeldapdv-stable-*.tar.gz
#      ./scripts/vps-update.sh
#
#  O que faz:
#    1) backup opcional do Postgres (volume restaurante_zeldapdv_pgdata)
#    2) reconstrói APENAS o container da aplicação (crm-zeldapdv)
#    3) as migrações do banco (ensureSchema) rodam automaticamente na subida
#    4) aguarda a aplicação responder em /login antes de concluir
#
#  Variáveis:
#    COMPOSE_FILE   compose a usar (padrão: docker-compose-zeldapdv.yml)
#    APP_SERVICE    serviço da aplicação (padrão: crm-zeldapdv)
#    SKIP_BACKUP    1 para pular o backup prévio
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose-zeldapdv.yml}"
APP_SERVICE="${APP_SERVICE:-crm-zeldapdv}"
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

log()  { printf '\033[1;32m[update]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker não encontrado"
[ -f "$COMPOSE_FILE" ] || die "compose não encontrado: $COMPOSE_FILE"

# 1) Backup preventivo do banco (dump via container do Postgres).
if [ "${SKIP_BACKUP:-}" != "1" ]; then
  if [ -f deploy/db-backup.sh ]; then
    log "Backup preventivo do banco (deploy/db-backup.sh)..."
    ( cd deploy && ./db-backup.sh ) || warn "backup falhou - continuando mesmo assim."
  else
    warn "deploy/db-backup.sh não encontrado - pulando backup."
  fi
fi

# 2) Reconstrói só o container da aplicação. O volume do Postgres NÃO é
#    recriado, então os dados são preservados.
log "Reconstruindo a aplicação ($APP_SERVICE)... manterá o banco de dados."
docker compose -f "$COMPOSE_FILE" up -d --build "$APP_SERVICE"

# 3) Aguarda a aplicação responder.
PORT="$(grep -E '^[[:space:]]*- "[0-9]+:3000"' "$COMPOSE_FILE" | head -1 | sed -E 's/.*"([0-9]+):3000".*/\1/')"
PORT="${PORT:-3013}"
URL="http://127.0.0.1:${PORT}/login"
log "Aguardando $URL responder..."
ok=""
for i in $(seq 1 40); do
  if curl -fsS -o /dev/null --max-time 3 "$URL"; then ok=1; break; fi
  sleep 2
done
[ -n "$ok" ] || warn "Aplicação ainda não respondeu; verifique 'docker compose -f $COMPOSE_FILE ps'."

log "Atualização concluída. Banco de dados preservado."
