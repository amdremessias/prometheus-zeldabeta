#!/usr/bin/env bash
# ============================================================================
# Zelda PDV — Restore manual do banco (Postgres 16)
# Restaura o dump (formato custom) selecionado na pasta local OU no volume.
#
# Uso:
#   ./scripts/db-restore.sh <arquivo.dump>           # restaura da pasta local
#   ./scripts/db-restore.sh --volume <arquivo.dump>  # restaura do volume Docker
# ============================================================================
set -euo pipefail

CONTAINER="${CONTAINER:-restaurante-zeldapdv-postgres}"
CRM_CONTAINER="${CRM_CONTAINER:-restaurante-zeldapdv-crm}"
VOLUME="${VOLUME:-}"
PG_USER="${PG_USER:-zelda}"
PG_DB="${PG_DB:-zeldapdv}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="${LOCAL_DIR:-$SELF_DIR/../backups}"

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

SOURCE="local"
NAME=""

while [ $# -gt 0 ]; do
  case "$1" in
    --volume) SOURCE="volume"; shift ;;
    -h|--help)
      echo "Uso: $0 [--volume] <arquivo.dump>" >&2
      exit 0 ;;
    *) NAME="$1"; shift ;;
  esac
done

[ -n "$NAME" ] || { echo "ERRO: informe o arquivo do backup." >&2; exit 1; }
case "$NAME" in
  */*|*\\*) echo "ERRO: nome inválido." >&2; exit 1 ;;
esac

require_container

echo "==> Parando o CRM para evitar escrita durante o restore..."
docker stop restaurante-zeldapdv-crm >/dev/null 2>&1 || true

if [ "$SOURCE" = "volume" ]; then
  echo "==> Lendo dump do volume $(resolve_volume)..."
  mkdir -p "$LOCAL_DIR"
  TMP_LOCAL="$LOCAL_DIR/.restore-tmp-$NAME"
  if ! docker run --rm -v "$(resolve_volume):/backups" -v "$(to_win "$LOCAL_DIR"):/out" alpine:3.20 \
      sh -c "test -f /backups/$NAME && cp /backups/$NAME /out/.restore-tmp-$NAME"; then
    rm -f "$TMP_LOCAL"
    echo "ERRO: arquivo não existe no volume $(resolve_volume)." >&2
    docker start restaurante-zeldapdv-crm >/dev/null 2>&1 || true
    exit 1
  fi
  echo "==> Copiando dump do volume para o container..."
  docker cp "$(to_win "$TMP_LOCAL")" "$CONTAINER:/tmp/$NAME"
  rm -f "$TMP_LOCAL"
else
  [ -f "$LOCAL_DIR/$NAME" ] || { echo "ERRO: arquivo não existe em $LOCAL_DIR." >&2; exit 1; }
  echo "==> Copiando dump da pasta local para o container..."
  docker cp "$(to_win "$LOCAL_DIR")/$NAME" "$CONTAINER:/tmp/$NAME"
fi

echo "==> Restaurando banco '$PG_DB' em $CONTAINER..."
docker exec "$CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges --clean --if-exists "/tmp/$NAME"

echo "==> Limpando arquivo temporário..."
docker exec "$CONTAINER" rm -f "/tmp/$NAME" || true

echo "==> Subindo o CRM..."
docker start restaurante-zeldapdv-crm >/dev/null 2>&1 || true

echo "OK: restore concluído."