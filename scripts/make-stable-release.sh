#!/usr/bin/env bash
# ============================================================================
#  Zelda PDV - gera um tarball da versão estável para atualizar outra VPS.
#
#  Uso:
#      ./scripts/make-stable-release.sh
#
#  Saída:
#      zeldapdv-stable-<VERSAO>-<DATA>.tar.gz
#
#  O tarball NÃO inclui node_modules, .git, .next nem o .env local (o .env
#  da VPS de destino deve ser mantido). O banco de dados vive em um volume
#  Docker (restaurante_zeldapdv_pgdata) e não faz parte do pacote, então é
#  preservado ao aplicar a atualização.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

VERSION="1.11.14-import-31082026"
DATE="$(date +%Y%m%d)"
OUT="zeldapdv-stable-${VERSION}-${DATE}.tar.gz"

EXCLUDES=(
  --exclude=node_modules
  --exclude=.git
  --exclude=.next
  --exclude=.rollback
  --exclude=backups
  --exclude='*.log'
  --exclude=tsconfig.tsbuildinfo
  --exclude=.env
  --exclude=.env.local
)

# Conteúdo versionado que compõe a aplicação estável.
INCLUDES=(
  docker-compose-zeldapdv.yml
  docker-compose.deploy.yml
  Dockerfile
  docker-entrypoint.sh
  package.json
  package-lock.json
  next.config.ts
  next-env.d.ts
  tsconfig.json
  postcss.config.mjs
  eslint.config.mjs
  .dockerignore
  .gitignore
  src
  public
  n8n
  deploy
  scripts
  sql
  fiscal
  .env.example
  README.md
  SECURITY.md
  SISTEMA.md
  STABLE-VERSION.md
  ROLLBACK.md
  ROLLBACK_WPP_N8N.md
  LICENSING.md
  ROLLBACK_LICENSING.md
)

tar -czf "$OUT" "${EXCLUDES[@]}" "${INCLUDES[@]}"

echo "Tarball estável criado: $OUT"
echo "Tamanho: $(du -h "$OUT" | cut -f1)"
echo
echo "Para aplicar na VPS:"
echo "  1) rsync/scp $OUT para a VPS (sobre o diretório de deploy)"
echo "  2) na VPS: tar -xzf $OUT"
echo "  3) na VPS: ./scripts/vps-update.sh"
