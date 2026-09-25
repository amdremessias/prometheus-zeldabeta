#!/usr/bin/env bash
# ============================================================================
#  remove-client.sh <cliente> [--purge] — para e remove o stack de UM cliente.
#
#  Padrão: preserva o volume do Postgres (dados).
#  --purge: também apaga o volume/dados (irreversível — faça backup antes).
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
. "$SCRIPT_DIR/common.sh"

require docker

CLIENT="$(client_valid "${1:-}")"
PURGE=0
case "${2:-}" in
    --purge) PURGE=1 ;;
    "") ;;
    *) die "argumento inválido: $2 (use --purge p/ apagar dados)" ;;
esac

PORT="$(registry_get_port "$CLIENT")"
if [ -z "$PORT" ]; then
    die "cliente '$CLIENT' não encontrado no registry — nada a fazer."
fi

CDIR="$(client_dir "$CLIENT")"
ENV_FILE="$(client_env "$CLIENT")"
COMPOSE_FILE="$(client_compose "$CLIENT")"

if [ -f "$COMPOSE_FILE" ]; then
    log "Derribando stack de $CLIENT..."
    EV=""
    [ -f "$ENV_FILE" ] && EV="--env-file $ENV_FILE"
    if [ "$PURGE" -eq 1 ]; then
        # shellcheck disable=SC2086
        docker compose --project-name "$CLIENT" $EV -f "$COMPOSE_FILE" down -v
    else
        # shellcheck disable=SC2086
        docker compose --project-name "$CLIENT" $EV -f "$COMPOSE_FILE" down
    fi
fi

if [ -f "$(client_conf "$CLIENT")" ]; then
    log "Removendo conf do nginx: $(client_conf "$CLIENT")"
    $SUDO rm -f "$(client_conf "$CLIENT")"
    nginx_reload
fi

registry_del "$CLIENT"
rm -rf "$CDIR"

log "Cliente $CLIENT removido."
if [ "$PURGE" -eq 1 ]; then
    log "Dados apagados (volume ${CLIENT}_pgdata removido)."
else
    warn "Dados do volume '${CLIENT}_pgdata' preservados (restaure reintroduzindo o cliente)."
fi