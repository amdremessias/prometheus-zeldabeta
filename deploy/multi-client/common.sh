#!/usr/bin/env bash
# ============================================================================
#  common.sh — variáveis e funções compartilhadas do tooling multi-cliente.
#  Sourced pelos scripts: install.sh, add-client.sh, remove-client.sh,
#  backup-client.sh, list-clients.sh.
#
#  Variáveis de ambiente aceitas (todas opcionais):
#    WILDCARD_DOMAIN  domínio base dos clientes (padrão: internal.lab)
#    CLIENTS_DIR      onde ficam as pastas por cliente (padrão: <repo>/clients)
#    BACKUPS_DIR      onde ficam os dumps (padrão: <repo>/deploy/multi-client/backups)
#    NGINX_SITES      diretório de sites do nginx (padrão: /etc/nginx/sites-enabled)
#    HTTP_PORT/HTTPS_PORT  portas do nginx (padrão 80/443)
# ============================================================================

SCRIPT_MC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_MC_DIR/../.." && pwd)"

CLIENTS_DIR="${CLIENTS_DIR:-$PROJECT_ROOT/clients}"
REGISTRY="${CLIENTS_DIR}/.registry"
BACKUPS_DIR="${BACKUPS_DIR:-$SCRIPT_MC_DIR/backups}"
TEMPLATES_DIR="$SCRIPT_MC_DIR/templates"

WILDCARD_DOMAIN="${WILDCARD_DOMAIN:-internal.lab}"
NGINX_SITES="${NGINX_SITES:-/etc/nginx/sites-enabled}"
SSL_DIR="/etc/nginx/ssl/${WILDCARD_DOMAIN}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_PORT_BASE=30100

# sudo automático quando não for root
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

log()  { printf '\033[1;32m[multi]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || die "dependência não encontrada: $1"; }

# Valida e ecoa o nome do cliente (minúsculas, a-z0-9-).
client_valid() {
    local c="$1"
    [ -n "$c" ] || die "uso: informe o nome do cliente."
    case "$c" in
        *[!a-z0-9-]*|'') die "nome de cliente inválido: '$c' (minúsculas, letras/números/hífen)" ;;
    esac
    case "$c" in -*|*-) die "nome de cliente inválido (hífen em extremo): '$c'" ;; esac
    [ "${#c}" -le 32 ] || die "nome de cliente muito longo (máx. 32): '$c'"
    echo "$c"
}

# Registry: <cliente>\t<porta> por linha.
registry_get_port() {
    local c="$1"
    [ -f "$REGISTRY" ] || return 0
    awk -v c="$c" '$1 == c { print $2; exit }' "$REGISTRY"
}

registry_set() {
    local c="$1" p="$2"
    mkdir -p "$CLIENTS_DIR"
    if [ -f "$REGISTRY" ]; then
        if awk -v c="$c" '$1 == c { found=1; exit } END { exit !found }' "$REGISTRY"; then
            awk -v c="$c" -v p="$p" '$1 == c { $2 = p } { print }' "$REGISTRY" > "$REGISTRY.tmp" \
                && mv "$REGISTRY.tmp" "$REGISTRY"
        else
            printf '%s\t%s\n' "$c" "$p" >> "$REGISTRY"
        fi
    else
        printf '%s\t%s\n' "$c" "$p" > "$REGISTRY"
    fi
}

registry_del() {
    local c="$1"
    [ -f "$REGISTRY" ] || return 0
    awk -v c="$c" '$1 != c' "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"
}

# Próxima porta de app (base+1 em diante, sem colidir com o registry).
next_app_port() {
    local max=0 p
    if [ ! -f "$REGISTRY" ]; then
        echo $((APP_PORT_BASE + 1)); return
    fi
    while read -r _ p; do
        [ -n "$p" ] && [ "$p" -gt "$max" ] && max="$p"
    done < "$REGISTRY"
    [ "$max" -eq 0 ] && max="$APP_PORT_BASE"
    echo $((max + 1))
}

# Caminhos por cliente
client_dir()     { printf '%s/%s' "$CLIENTS_DIR" "$1"; }
client_env()     { printf '%s/.env' "$(client_dir "$1")"; }
client_compose() { printf '%s/docker-compose.yml' "$(client_dir "$1")"; }
client_conf()    { printf '%s/zeldapdv-%s.conf' "$NGINX_SITES" "$1"; }

# Lê uma chave de um .env (ex.: client_env_value <arquivo> JWT_SECRET)
client_env_value() {
    local f="$1" key="$2"
    [ -f "$f" ] || return 1
    grep -E "^${key}=" "$f" | head -n1 | cut -d= -f2-
}

# Gera (se ausente) o wildcard *.$WILDCARD_DOMAIN em /etc/nginx/ssl/<domínio>/.
ensure_wildcard_cert() {
    local CERT="$SSL_DIR/wildcard.pem" KEY="$SSL_DIR/wildcard-key.pem"
    $SUDO mkdir -p "$SSL_DIR"
    if $SUDO test -f "$CERT" && $SUDO test -f "$KEY"; then
        log "Wildcard *.$WILDCARD_DOMAIN já existe ($CERT) — reaproveitando."
        return
    fi
    log "Gerando wildcard *.$WILDCARD_DOMAIN em $SSL_DIR"
    $SUDO openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
        -keyout "$KEY" -out "$CERT" \
        -subj "/CN=$WILDCARD_DOMAIN/O=Zelda PDV/OU=MultiClient" \
        -addext "subjectAltName=DNS:$WILDCARD_DOMAIN,DNS:*.$WILDCARD_DOMAIN" \
        >/dev/null 2>&1
    $SUDO chmod 600 "$KEY"
}

# Testa e recarrega o nginx (nunca recarrega config inválida).
nginx_reload() {
    if $SUDO nginx -t; then
        if command -v systemctl >/dev/null 2>&1 && $SUDO systemctl is-active nginx >/dev/null 2>&1; then
            $SUDO systemctl reload nginx
        else
            $SUDO nginx -s reload 2>/dev/null \
                || warn "nginx não está ativo como serviço — inicie com 'sudo systemctl start nginx'."
        fi
    else
        die "nginx -t falhou. Revise os confs gerados em $NGINX_SITES."
    fi
}