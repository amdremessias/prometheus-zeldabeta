# Zelda PDV — ambiente do cliente: __CLIENT__ (local do CLIENTE)
# Arquivo GERADO pelo deploy/multi-client/add-client.sh. Não edite manualmente.
# Segredos únicos desta instância (JWT/ADMIN/DB) — não compartilhe entre clientes.

# --- Banco (credenciais únicas do Postgres deste cliente) ---
POSTGRES_USER=__DB_USER__
POSTGRES_PASSWORD=__DB_PASSWORD__
POSTGRES_DB=__DB_NAME__

# --- White label (embutido no build — ao mudar, refaça add-client.sh) ---
NEXT_PUBLIC_BRAND_NAME=__BRAND_NAME__
NEXT_PUBLIC_BRAND_DESCRIPTION=__BRAND_DESCRIPTION__
NEXT_PUBLIC_BRAND_LOGO=__BRAND_LOGO__
NEXT_PUBLIC_BRAND_COLOR=__BRAND_COLOR__
NEXT_PUBLIC_BRAND_FOOTER=__BRAND_FOOTER__

# --- Runtime ---
JWT_SECRET=__JWT_SECRET__
ADMIN_EMAIL=__ADMIN_EMAIL__
ADMIN_PASSWORD=__ADMIN_PASSWORD__

# --- Limites de recursos do cliente (docker compose deploy.resources) ---
CLIENT_MEM_LIMIT=512m
CLIENT_CPU_LIMIT=0.5

# --- Licenciamento (JWT Ed25519 / EdDSA) — DESLIGADO por padrão ---
# Não bloqueia enquanto LICENSE_MASTER_PUBLIC_KEY estiver vazio.
# Para habilitar no futuro (por cliente): defina LICENSE_MASTER_PUBLIC_KEY
# (sua chave pública) e LICENSE_JWT (token emitido via Master). A chave
# privada (LICENSE_MASTER_PRIVATE_KEY) NUNCA vai no cliente — fica só no Master.
LICENSE_CLIENT_ID=__CLIENT__
LICENSE_DOMAIN=
LICENSE_MASTER_PUBLIC_KEY=
LICENSE_MASTER_PRIVATE_KEY=
LICENSE_JWT=
MASTER_API_TOKEN=