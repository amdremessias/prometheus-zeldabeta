#!/usr/bin/env bash
# ============================================================================
#  backup-client.sh <cliente> — pg_dump do banco do cliente para
#  <BACKUPS_DIR>/<cliente>/pgdump-<timestamp>.sql.gz
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
. "$SCRIPT_DIR/common.sh"

require docker

CLIENT="$(client_valid "${1:-}")"
ENV_FILE="$(client_env "$CLIENT")"

[ -f "$ENV_FILE" ] || die "sem .env para '$CLIENT' (cliente não provisionado?)."
DB_USER="$(client_env_value "$ENV_FILE" POSTGRES_USER)"
DB_NAME="$(client_env_value "$ENV_FILE" POSTGRES_DB)"
[ -n "$DB_USER" ] && [ -n "$DB_NAME" ] || die "POSTGRES_USER/POSTGRES_DB ausentes no .env."

CONTAINER="zeldapdv-$CLIENT-db"
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    die "container '$CONTAINER' não está rodando. Suba o stack com add-client.sh."
fi

TS="$(date +%Y%m%d-%H%M%S)"
DEST_DIR="$BACKUPS_DIR/$CLIENT"
mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/pgdump-$TS.sql.gz"

log "Backup de $CLIENT -> $DEST"
docker exec -i "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$DEST"

SIZE="$(du -h "$DEST" | cut -f1)"
log "Backup concluído ($SIZE): $DEST"