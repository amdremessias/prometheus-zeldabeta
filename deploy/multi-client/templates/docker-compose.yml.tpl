# Zelda PDV — stack de UM cliente (multi-cliente)
# Arquivo GERADO pelo deploy/multi-client/add-client.sh. Não edite manualmente.
# Placeholders (substituídos via sed pelo add-client.sh):
#   __CLIENT__ __CONTEXT__ __APP_PORT__
# Variáveis interpoladas do .env do cliente (--env-file):
#   POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET ADMIN_EMAIL ADMIN_PASSWORD
#   NEXT_PUBLIC_BRAND_* CLIENT_MEM_LIMIT CLIENT_CPU_LIMIT
#   LICENSE_CLIENT_ID LICENSE_DOMAIN LICENSE_MASTER_PUBLIC_KEY LICENSE_MASTER_PRIVATE_KEY
#   LICENSE_JWT MASTER_API_TOKEN  (licenciamento — DESLIGADO se pública vazia)

name: __CLIENT__

services:
  db:
    image: postgres:16-alpine
    container_name: zeldapdv-__CLIENT__-db
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  app:
    build:
      context: __CONTEXT__
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_BRAND_NAME: ${NEXT_PUBLIC_BRAND_NAME}
        NEXT_PUBLIC_BRAND_DESCRIPTION: ${NEXT_PUBLIC_BRAND_DESCRIPTION}
        NEXT_PUBLIC_BRAND_LOGO: ${NEXT_PUBLIC_BRAND_LOGO}
        NEXT_PUBLIC_BRAND_COLOR: ${NEXT_PUBLIC_BRAND_COLOR}
        NEXT_PUBLIC_BRAND_FOOTER: ${NEXT_PUBLIC_BRAND_FOOTER}
    image: zeldapdv:__CLIENT__
    container_name: zeldapdv-__CLIENT__-app
    # Porta do app limitada ao loopback — só o nginx do host acessa.
    ports:
      - "127.0.0.1:__APP_PORT__:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ZELDAPDV_WEBHOOK_SECRET: ${ZELDAPDV_WEBHOOK_SECRET}
      CRM_WEBHOOK_SECRET: ${ZELDAPDV_WEBHOOK_SECRET}
      ZELDAPDV_INTERNAL_URL: http://127.0.0.1:3000
      WAHA_WEBHOOK_HMAC_KEY: ${WAHA_WEBHOOK_HMAC_KEY}
      WHATSAPP_PROVIDER: ${WHATSAPP_PROVIDER:-waha}
      WAHA_API_URL: ${WAHA_API_URL:-}
      WAHA_API_KEY: ${WAHA_API_KEY:-}
      WAHA_SESSION: ${WAHA_SESSION:-default}
      WHATSAPP_CLOUD_PHONE_ID: ${WHATSAPP_CLOUD_PHONE_ID:-}
      WHATSAPP_CLOUD_ACCESS_TOKEN: ${WHATSAPP_CLOUD_ACCESS_TOKEN:-}
      WHATSAPP_CLOUD_VERIFY_TOKEN: ${WHATSAPP_CLOUD_VERIFY_TOKEN:-}
      WHATSAPP_CLOUD_APP_SECRET: ${WHATSAPP_CLOUD_APP_SECRET:-}
      WHATSAPP_CLOUD_GRAPH_VERSION: ${WHATSAPP_CLOUD_GRAPH_VERSION:-v20.0}
      ZELDAPDV_AI_PROVIDER: ${ZELDAPDV_AI_PROVIDER:-gemini}
      ZELDAPDV_AI_WEBHOOK_URL: ${ZELDAPDV_AI_WEBHOOK_URL:-}
      ZELDAPDV_AI_TIMEOUT_MS: ${ZELDAPDV_AI_TIMEOUT_MS:-20000}
      ZELDAPDV_AI_GATEWAY_URL: ${ZELDAPDV_AI_GATEWAY_URL:-}
      ZELDAPDV_AI_GATEWAY_API_KEY: ${ZELDAPDV_AI_GATEWAY_API_KEY:-}
      ZELDAPDV_AI_GATEWAY_MODEL: ${ZELDAPDV_AI_GATEWAY_MODEL:-default}
      ZELDAPDV_AI_GATEWAY_TIMEOUT_MS: ${ZELDAPDV_AI_GATEWAY_TIMEOUT_MS:-30000}
      ZELDAPDV_AI_FALLBACK_TO_GEMINI: ${ZELDAPDV_AI_FALLBACK_TO_GEMINI:-false}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      GEMINI_MODEL: ${GEMINI_MODEL:-gemini-3.6-flash}
      # Licenciamento (dormante: só ativa se LICENSE_MASTER_PUBLIC_KEY preenchido)
      LICENSE_CLIENT_ID: ${LICENSE_CLIENT_ID}
      LICENSE_DOMAIN: ${LICENSE_DOMAIN}
      LICENSE_MASTER_PUBLIC_KEY: ${LICENSE_MASTER_PUBLIC_KEY}
      LICENSE_MASTER_PRIVATE_KEY: ${LICENSE_MASTER_PRIVATE_KEY}
      LICENSE_JWT: ${LICENSE_JWT}
      MASTER_API_TOKEN: ${MASTER_API_TOKEN}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: ${CLIENT_MEM_LIMIT:-512m}
          cpus: ${CLIENT_CPU_LIMIT:-'0.5'}

volumes:
  pgdata: