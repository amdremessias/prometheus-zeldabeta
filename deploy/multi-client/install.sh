#!/usr/bin/env bash
# ============================================================================
#  install.sh — prepara a VPS para o modelo multi-cliente (rodar 1x).
#   - cria a estrutura de clientes/backups
#   - gera o certificado wildcard *.DOMAIN (autoassinado)
#   - garante o diretório de sites do nginx
#  Não provisiona nenhum cliente (use add-client.sh).
#
#  Uso:
#      ./deploy/multi-client/install.sh
#      WILDCARD_DOMAIN=internal.lab NGINX_SITES=/etc/nginx/conf.d ./deploy/multi-client/install.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
. "$SCRIPT_DIR/common.sh"

log "Instalação multi-cliente (domínio wildcard: *.$WILDCARD_DOMAIN)"

require docker
require openssl
require nginx

# 1. Estrutura local de clientes e backups
mkdir -p "$CLIENTS_DIR" "$BACKUPS_DIR"
log "Clientes em: $CLIENTS_DIR"
log "Backups em:  $BACKUPS_DIR"

# 2. Certificado wildcard
ensure_wildcard_cert

# 3. Diretório de sites do nginx (confirma o include)
if $SUDO test -d "$NGINX_SITES"; then
    log "nginx sites: $NGINX_SITES"
else
    warn "$NGINX_SITES não existe — confirme o 'include' no /etc/nginx/nginx.conf"
    $SUDO mkdir -p "$NGINX_SITES"
fi

echo
log "Aponte o DNS wildcard:  *.$WILDCARD_DOMAIN  ->  (IP da VPS)"
echo
log "Instalação concluída."
log "Provisione um cliente:  $SCRIPT_DIR/add-client.sh <cliente>"
log "Estado:                 $SCRIPT_DIR/list-clients.sh"