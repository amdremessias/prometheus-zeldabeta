#!/usr/bin/env bash
# ============================================================================
#  list-clients.sh — mostra o estado dos clientes provisionados
#  (registry + URL + estado do container app de cada um).
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
. "$SCRIPT_DIR/common.sh"

if [ ! -f "$REGISTRY" ] || [ ! -s "$REGISTRY" ]; then
    log "Nenhum cliente provisionado."
    exit 0
fi

printf '%-18s %-8s %-34s %s\n' 'CLIENTE' 'PORTA' 'URL' 'APP (docker)'
printf '%-18s %-8s %-34s %s\n' '-------' '-----' '---' '-----------'
while read -r c p; do
    [ -z "$c" ] && continue
    state="$(docker inspect -f '{{.State.Status}}' "zeldapdv-$c-app" 2>/dev/null || echo 'sem stack')"
    printf '%-18s %-8s %-34s %s\n' "$c" "$p" "https://$c.$WILDCARD_DOMAIN" "$state"
done < "$REGISTRY"

echo
log "Backups em: $BACKUPS_DIR (use backup-client.sh <cliente>)"