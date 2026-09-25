# ============================================================================
#  Zelda PDV - imagem standalone (multi-stage)
#  O Next.js builda dentro do Docker, embutindo as variáveis NEXT_PUBLIC_*
#  (logo/identidade) via ARG — ideal para o fluxo multi-cliente (add-client.sh).
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_BRAND_LOGO
ARG NEXT_PUBLIC_BRAND_DESCRIPTION
ARG NEXT_PUBLIC_BRAND_COLOR
ARG NEXT_PUBLIC_BRAND_FOOTER
ENV NEXT_PUBLIC_BRAND_NAME="${NEXT_PUBLIC_BRAND_NAME:-Zelda PDV Food}" \
    NEXT_PUBLIC_BRAND_LOGO="${NEXT_PUBLIC_BRAND_LOGO:-/logo.svg}" \
    NEXT_PUBLIC_BRAND_DESCRIPTION="${NEXT_PUBLIC_BRAND_DESCRIPTION:-}" \
    NEXT_PUBLIC_BRAND_COLOR="${NEXT_PUBLIC_BRAND_COLOR:-#16a34a}" \
    NEXT_PUBLIC_BRAND_FOOTER="${NEXT_PUBLIC_BRAND_FOOTER:-}"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Cliente do Postgres (pg_dump/pg_restore) usado pela rotina de backup.
RUN apk add --no-cache postgresql-client
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER root
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]