#!/usr/bin/env bash
# ============================================================================
# Zelda PDV — Backup manual do banco (Postgres 16)
# Redundância dupla: volume Docker (restaurante_zeldapdv_backups) + pasta local.
#
# Uso:
#   ./scripts/db-backup.sh              # grava backup nomeado por timestamp
#   ./scripts/db-backup.sh list         # lista backups (volume + local)
#   ./scripts/db-backup.sh download <arquivo>   # copia do volume para a pasta local
# ============================================================================
set -euo pipefail

CONTAINER="${CONTAINER:-restaurante-zeldapdv-postgres}"
CRM_CONTAINER="${CRM_CONTAINER:-restaurante-zeldapdv-crm}"
VOLUME="${VOLUME:-}"
PG_USER="${PG_USER:-zelda}"
PG_DB="${PG_DB:-zeldapdv}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="${LOCAL_DIR:-$SELF_DIR/../backups}"

marker() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

require_container() {
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "ERRO: container $CONTAINER não está rodando." >&2
    exit 1
  fi
}

docker() {
  MSYS_NO_PATHCONV=1 command docker "$@"
}

resolve_volume() {
  if [ -n "$VOLUME" ]; then
    echo "$VOLUME"
    return
  fi
  local auto
  auto="$(docker inspect "$CRM_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/backups"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
  if [ -n "$auto" ]; then
    echo "$auto"
  else
    echo "restaurante_zeldapdv_backups"
  fi
}

to_win() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$p"
  else
    printf '%s' "$p"
  fi
}

list_volume() {
  docker run --rm -v "$(resolve_volume):/backups" alpine:3.20 \
    sh -c 'ls -1 /backups/*.dump 2>/dev/null | sed "s#/backups/##"' || true
}

do_list() {
  echo "== Volume ($(resolve_volume)) =="
  list_volume
  echo "== Pasta local ($LOCAL_DIR) =="
  ls -1 "$LOCAL_DIR" 2>/dev/null | grep '\.dump$' || true
}

do_backup() {
  require_container
  mkdir -p "$LOCAL_DIR"
  STAMP="zelda_pdv_$(date +%Y%m%d_%H%M%S)"
  TMP="$STAMP.dump.tmp"

  echo "==> Gerando dump no container $CONTAINER..."
  docker exec "$CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges --format=custom -f "/tmp/$TMP"
  docker exec "$CONTAINER" mv "/tmp/$TMP" "/tmp/$STAMP.dump"

  echo "==> Copiando para a pasta local..."
  docker cp "$CONTAINER:/tmp/$STAMP.dump" "$(to_win "$LOCAL_DIR")/$STAMP.dump"
  docker exec "$CONTAINER" rm -f "/tmp/$STAMP.dump" "/tmp/$TMP"

  echo "==> Copiando para o volume $(resolve_volume)..."
  docker run --rm -v "$(resolve_volume):/backups" -v "$(to_win "$LOCAL_DIR"):/host" alpine:3.20 \
    cp "/host/$STAMP.dump" "/backups/$STAMP.dump"

  SIZE=$(wc -c < "$LOCAL_DIR/$STAMP.dump" | tr -d ' ')
  echo "OK: $STAMP.dump ($SIZE bytes) — local + volume."
}

do_download() {
  local name="$1"
  mkdir -p "$LOCAL_DIR"
  if ! docker run --rm -v "$(resolve_volume):/backups" -v "$(to_win "$LOCAL_DIR"):/host" alpine:3.20 \
      sh -c "test -f /backups/$name"; then
    echo "ERRO: arquivo não encontrado no volume (resolve_volume)." >&2
    exit 1
  fi
  docker run --rm -v "$(resolve_volume):/backups" -v "$(to_win "$LOCAL_DIR"):/host" alpine:3.20 \
    cp "/backups/$name" "/host/$name"
  echo "OK: $name copiado para $LOCAL_DIR"
}

case "${1:-backup}" in
  list) do_list ;;
  download)
    [ $# -ge 2 ] || { echo "Uso: $0 download <arquivo>" >&2; exit 1; }
    do_download "$2" ;;
  backup) do_backup ;;
  *) echo "Uso: $0 [backup|list|download <arquivo>]" >&2; exit 1 ;;
esac