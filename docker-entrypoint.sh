#!/bin/sh
# Entrypoint do CRM Zelda PDV.
# Garante que o diretório de backups (/backups) seja gravável pelo usuário
# "node" (o volume é montado como root) e então sobe o servidor como node.
set -e

mkdir -p /backups
chown node:node /backups 2>/dev/null || true

exec su node -s /bin/sh -c "node server.js"
