#!/usr/bin/env bash
# ============================================================================
#  add-client.sh <cliente> — provisiona/atualiza o stack de UM cliente.
#
#  Idempotente: reexecutar para o mesmo cliente faz rebuild e reposiciona o
#  nginx sem alterar segredos (.env preservado) nem o volume do banco.
#
#  Uso:
#      ./deploy/multi-client/add-client.sh xclient
#      ./deploy/multi-client/add-client.sh loja-norte \
#          --brand-name "Loja Norte" --brand-color "#0ea5e9"
#
#  Flags opcionais de branding (defaults vêm do .env do repo, se existir):
#      --brand-name --brand-description --brand-logo --brand-color --brand-footer
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
. "$SCRIPT_DIR/common.sh"

require docker
require openssl

# ---------------------------------------------------------------------------
# Argumentos
# ---------------------------------------------------------------------------
CLIENT=""
BRAND_NAME=""; BRAND_DESCRIPTION=""; BRAND_LOGO=""; BRAND_COLOR=""; BRAND_FOOTER=""

while [ $# -gt 0 ]; do
    case "$1" in
        --brand-name)        BRAND_NAME="$2"; shift 2 ;;
        --brand-description) BRAND_DESCRIPTION="$2"; shift 2 ;;
        --brand-logo)        BRAND_LOGO="$2"; shift 2 ;;
        --brand-color)       BRAND_COLOR="$2"; shift 2 ;;
        --brand-footer)      BRAND_FOOTER="$2"; shift 2 ;;
        -*) die "flag desconhecida: $1" ;;
        *) CLIENT="$1"; shift ;;
    esac
done
CLIENT="$(client_valid "$CLIENT")"

# Defaults de branding: .env do repo > valores fixos.
if [ -f "$PROJECT_ROOT/.env" ]; then
    BRAND_NAME="${BRAND_NAME:-$(client_env_value "$PROJECT_ROOT/.env" NEXT_PUBLIC_BRAND_NAME)}"
    BRAND_DESCRIPTION="${BRAND_DESCRIPTION:-$(client_env_value "$PROJECT_ROOT/.env" NEXT_PUBLIC_BRAND_DESCRIPTION)}"
    BRAND_LOGO="${BRAND_LOGO:-$(client_env_value "$PROJECT_ROOT/.env" NEXT_PUBLIC_BRAND_LOGO)}"
    BRAND_COLOR="${BRAND_COLOR:-$(client_env_value "$PROJECT_ROOT/.env" NEXT_PUBLIC_BRAND_COLOR)}"
    BRAND_FOOTER="${BRAND_FOOTER:-$(client_env_value "$PROJECT_ROOT/.env" NEXT_PUBLIC_BRAND_FOOTER)}"
fi
BRAND_NAME="${BRAND_NAME:-Zelda PDV}"
BRAND_DESCRIPTION="${BRAND_DESCRIPTION:-O sistema completo de PDV para o seu estabelecimento: venda rápida, fiado, delivery e relatórios.}"
BRAND_LOGO="${BRAND_LOGO:-/logo.svg}"
BRAND_COLOR="${BRAND_COLOR:-#16a34a}"
BRAND_FOOTER="${BRAND_FOOTER:-Todos direitos reservados.}"

# ---------------------------------------------------------------------------
# Porta do app (persistida no registry; reuso se já existe)
# ---------------------------------------------------------------------------
PORT="$(registry_get_port "$CLIENT")"
if [ -z "$PORT" ]; then
    PORT="$(next_app_port)"
    registry_set "$CLIENT" "$PORT"
fi
log "Cliente: $CLIENT | app: http://127.0.0.1:$PORT | https://$CLIENT.$WILDCARD_DOMAIN"

CDIR="$(client_dir "$CLIENT")"
mkdir -p "$CDIR"

# ---------------------------------------------------------------------------
# .env do cliente (segredos únicos no 1º provisionamento)
# ---------------------------------------------------------------------------
ENV_FILE="$(client_env "$CLIENT")"
if [ ! -f "$ENV_FILE" ]; then
    log "Gerando .env com segredos únicos para $CLIENT"
    DB_USER="zelda_${CLIENT//-/_}"
    DB_PASSWORD="$(openssl rand -hex 16)"
    DB_NAME="${CLIENT//-/_}"
    JWT_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
    ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '\n')"
    ADMIN_EMAIL="adm@$CLIENT.$WILDCARD_DOMAIN"

    sed -e "s|__CLIENT__|$CLIENT|g" \
        -e "s|__DB_USER__|$DB_USER|g" \
        -e "s|__DB_PASSWORD__|$DB_PASSWORD|g" \
        -e "s|__DB_NAME__|$DB_NAME|g" \
        -e "s|__JWT_SECRET__|$JWT_SECRET|g" \
        -e "s|__ADMIN_EMAIL__|$ADMIN_EMAIL|g" \
        -e "s|__ADMIN_PASSWORD__|$ADMIN_PASSWORD|g" \
        -e "s|__BRAND_NAME__|$BRAND_NAME|g" \
        -e "s|__BRAND_DESCRIPTION__|$BRAND_DESCRIPTION|g" \
        -e "s|__BRAND_LOGO__|$BRAND_LOGO|g" \
        -e "s|__BRAND_COLOR__|$BRAND_COLOR|g" \
        -e "s|__BRAND_FOOTER__|$BRAND_FOOTER|g" \
        "$TEMPLATES_DIR/client.env.tpl" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    say_admin=1
else
    warn ".env já existe — reutilizando (segredos preservados)."
    if [ -n "$ADMIN_PASSWORD" ] || [ -n "$BRAND_NAME" ]; then
        warn "Alterações de branding/senha só valem no 1º provisionamento ou editando o .env manualmente."
    fi
fi

# ---------------------------------------------------------------------------
# docker-compose.yml do cliente (placeholders: cliente/contexto/porta)
# ---------------------------------------------------------------------------
sed -e "s|__CLIENT__|$CLIENT|g" \
    -e "s|__CONTEXT__|$PROJECT_ROOT|g" \
    -e "s|__APP_PORT__|$PORT|g" \
    "$TEMPLATES_DIR/docker-compose.yml.tpl" > "$(client_compose "$CLIENT")"

# ---------------------------------------------------------------------------
# Build + subida da stack
# ---------------------------------------------------------------------------
COMPOSE_FILE="$(client_compose "$CLIENT")"
log "Subindo stack (build pode levar 1-2 min)..."
docker compose --project-name "$CLIENT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

log "Aguardando app responder em http://127.0.0.1:$PORT/login"
ok=""
for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/login"; then
        ok=1; break
    fi
    sleep 2
done
[ -n "$ok" ] || warn "App ainda não respondeu; confira 'docker compose -p $CLIENT -f $COMPOSE_FILE ps'."

# ---------------------------------------------------------------------------
# nginx: gerar conf, testar e recarregar
# ---------------------------------------------------------------------------
ensure_wildcard_cert
log "Gerando nginx conf: $(client_conf "$CLIENT")"
$SUDO sed -e "s|__CLIENT__|$CLIENT|g" \
    -e "s|__DOMAIN__|$WILDCARD_DOMAIN|g" \
    -e "s|__APP_PORT__|$PORT|g" \
    -e "s|__HTTP_PORT__|$HTTP_PORT|g" \
    -e "s|__HTTPS_PORT__|$HTTPS_PORT|g" \
    "$TEMPLATES_DIR/nginx-client.conf.tpl" | $SUDO tee "$(client_conf "$CLIENT")" >/dev/null

nginx_reload

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------
echo
log "Deploy de $CLIENT concluído!"
echo
echo "  URL:        https://$CLIENT.$WILDCARD_DOMAIN   (HTTP redireciona p/ HTTPS)"
echo "  App local:  http://127.0.0.1:$PORT"
if [ -f "$ENV_FILE" ] && [ "${say_admin:-0}" = "1" ]; then
    echo "  Admin:      $ADMIN_EMAIL   (senha: ADMIN_PASSWORD em $ENV_FILE)"
fi
echo
log "DNS: 'dig $CLIENT.$WILDCARD_DOMAIN' deve resolver para o IP da VPS."