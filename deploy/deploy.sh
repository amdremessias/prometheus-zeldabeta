#!/usr/bin/env bash
#
# ============================================================================
#  Zelda PDV — deploy da stack (Next.js standalone + Postgres)
#  com nginx como reverse proxy e TLS automático.
#
#  Uso local (TLS autoassinado):
#      ./deploy/deploy.sh
#      DEPLOY_DOMAIN=pdv.local ./deploy/deploy.sh
#
#  Uso em VPS (subdomínio, certificado real Let's Encrypt):
#      CERT_MODE=letsencrypt \
#      DEPLOY_DOMAIN=pdv.seudominio.com \
#      LETSENCRYPT_EMAIL=voce@seudominio.com \
#      ./deploy/deploy.sh
#
#  Variáveis aceitas (todas opcionais):
#      DEPLOY_DOMAIN        hostname a servir (padrão: pdv.local)
#      CERT_MODE            selfsigned | letsencrypt (padrão: selfsigned)
#      LETSENCRYPT_EMAIL    obrigatório em CERT_MODE=letsencrypt
#      HTTP_PORT / HTTPS_PORT   portas do nginx (padrão 80/443)
#      APP_PORT             porta do container da aplicação (padrão 3000)
#      CERT_DIR             onde salvar o autoassinado (padrão: ./deploy/certs)
#      NGINX_SITES          diretório de sites-enabled (padrão /etc/nginx/sites-enabled)
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-pdv.local}"
CERT_MODE="${CERT_MODE:-selfsigned}"            # selfsigned | letsencrypt
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_PORT="${APP_PORT:-3000}"
UPSTREAM="127.0.0.1:${APP_PORT}"
CERT_DIR="${CERT_DIR:-$SCRIPT_DIR/certs}"
NGINX_SITES="${NGINX_SITES:-/etc/nginx/sites-enabled}"
NGINX_CONF_NAME="zeldapdv.conf"
TEMPLATE="$SCRIPT_DIR/nginx/zeldapdv.conf.template"
CERT_DAYS=3650

# sudo automático quando não for root
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

log()  { printf '\033[1;32m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

require() {
    command -v "$1" >/dev/null 2>&1 || die "dependência não encontrada: $1"
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
log "Preflight..."
require docker
require openssl
[ "$CERT_MODE" = "selfsigned" ] || [ "$CERT_MODE" = "letsencrypt" ] \
    || die "CERT_MODE inválido: $CERT_MODE (use selfsigned ou letsencrypt)"

if [ "$CERT_MODE" = "letsencrypt" ]; then
    require certbot
    [ -n "$LETSENCRYPT_EMAIL" ] || die "CERT_MODE=letsencrypt exige LETSENCRYPT_EMAIL"
    case "$DEPLOY_DOMAIN" in
        localhost|*.local|*.lan) die "letsencrypt não aceita domínio local: $DEPLOY_DOMAIN" ;;
    esac
fi

cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Ambiente (.env)
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
    log "Criando .env a partir de .env.example"
    cp .env.example .env
    warn "Edite .env: troque JWT_SECRET e ADMIN_PASSWORD antes de expor o serviço."
fi

# ---------------------------------------------------------------------------
# Certificado TLS
# ---------------------------------------------------------------------------
CERT=""; KEY=""
case "$CERT_MODE" in
    selfsigned)
        mkdir -p "$CERT_DIR"
        CERT="$CERT_DIR/cert.pem"
        KEY="$CERT_DIR/key.pem"
        if [ -f "$CERT" ] && [ -f "$KEY" ]; then
            log "Certificado autoassinado já existe ($CERT) — reaproveitando."
        else
            log "Gerando certificado autoassinado para '$DEPLOY_DOMAIN' (SAN inclui localhost/127.0.0.1)"
            openssl req -x509 -newkey rsa:2048 -sha256 -days "$CERT_DAYS" -nodes \
                -keyout "$KEY" -out "$CERT" \
                -subj "/CN=$DEPLOY_DOMAIN/O=Zelda PDV/OU=Local" \
                -addext "subjectAltName=DNS:$DEPLOY_DOMAIN,DNS:localhost,IP:127.0.0.1" \
                >/dev/null 2>&1
            chmod 600 "$KEY"
        fi
        HSTS=""
        ;;
    letsencrypt)
        CERT="/etc/letsencrypt/live/$DEPLOY_DOMAIN/fullchain.pem"
        KEY="/etc/letsencrypt/live/$DEPLOY_DOMAIN/privkey.pem"
        log "Solicitando certificado Let's Encrypt para '$DEPLOY_DOMAIN' (--nginx)"
        $SUDO certbot certonly --nginx -d "$DEPLOY_DOMAIN" \
            --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL"
        HSTS="add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;"
        ;;
esac

# ---------------------------------------------------------------------------
# Build e subida da stack (Docker Compose)
# ---------------------------------------------------------------------------
log "Build e subida dos containers (db + restaurante)..."
# DATABASE_URL exportada sobrepõe .env no compose: dentro do container o
# Postgres está em 'db:5432' (não em localhost:5434, que é só para dev local).
DATABASE_URL="postgresql://zelda:zelda@db:5432/zeldapdv" \
    docker compose up -d --build db restaurante

log "Aguardando aplicação responder em http://127.0.0.1:${APP_PORT}"
ok=""
for i in $(seq 1 30); do
    if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${APP_PORT}/login"; then
        ok=1; break
    fi
    sleep 2
done
[ -n "$ok" ] || warn "Aplicação ainda não respondeu; verifique com 'docker compose ps'."

# ---------------------------------------------------------------------------
# nginx: gerar config, testar e recarregar
# ---------------------------------------------------------------------------
log "Configurando nginx ($NGINX_SITES/$NGINX_CONF_NAME)..."
require nginx
$SUDO mkdir -p "$NGINX_SITES"

sed -e "s|__DOMAIN__|$DEPLOY_DOMAIN|g" \
    -e "s|__HTTP_PORT__|$HTTP_PORT|g" \
    -e "s|__HTTPS_PORT__|$HTTPS_PORT|g" \
    -e "s|__UPSTREAM__|$UPSTREAM|g" \
    -e "s|__CERT__|$CERT|g" \
    -e "s|__KEY__|$KEY|g" \
    -e "s|__HSTS__|$HSTS|g" \
    "$TEMPLATE" | $SUDO tee "$NGINX_SITES/$NGINX_CONF_NAME" >/dev/null

if $SUDO nginx -t; then
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active nginx >/dev/null 2>&1; then
        $SUDO systemctl reload nginx
    else
        $SUDO nginx -s reload 2>/dev/null || warn "nginx não está rodando como serviço — inicie com 'sudo systemctl start nginx'."
    fi
else
    die "nginx -t falhou. Confirme que 'include $NGINX_SITES/*' existe em /etc/nginx/nginx.conf."
fi

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------
log "Deploy concluído!"
echo
echo "  URL:        https://${DEPLOY_DOMAIN}  (HTTP redireciona para HTTPS)"
echo "  App direto: http://127.0.0.1:${APP_PORT}"
echo "  Certificado:${CERT_MODE}  ->  $CERT"
if [ -f .env ]; then
    ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2 || true)"
    echo "  Admin:      ${ADMIN_EMAIL:-adm@zeldapdv.lab}  (senha: ADMIN_PASSWORD do .env)"
fi
echo
case "$CERT_MODE" in
    selfsigned)
        echo "  DICA local: adicione '${DEPLOY_DOMAIN} 127.0.0.1' ao /etc/hosts e "
        echo "              aceite o aviso do certificado autoassinado no navegador."
        ;;
    letsencrypt)
        echo "  DICA VPS:   certbot renova automaticamente via systemd timer."
        ;;
esac
echo
warn "Em produção: troque JWT_SECRET e ADMIN_PASSWORD no .env e reconstrua."
