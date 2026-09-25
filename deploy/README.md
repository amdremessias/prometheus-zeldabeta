# Deploy da stack (nginx + TLS)

Scripts para subir a stack completa **Zelda PDV** (Next.js standalone + Postgres 16) atrás do **nginx** como reverse proxy com TLS automático.

- `deploy.sh` — orquestra tudo: preflight → `.env` → certificado → Docker Compose → nginx.
- `nginx/zeldapdv.conf.template` — template do site nginx (HTTP→HTTPS + proxy + segurança).
- `certs/` — certificado autoassinado gerado (não versionar; já ignorado).

## Requisitos (Linux / WSL)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 openssl nginx curl
sudo usermod -aG docker "$USER"     # reabra a sessão para aplicar
```

## Uso local (TLS autoassinado)

```bash
./deploy/deploy.sh
# ou com hostname próprio
DEPLOY_DOMAIN=pdv.local ./deploy/deploy.sh
```

O que acontece:

1. Cria `.env` a partir de `.env.example` (se não existir) — **edite `JWT_SECRET` e `ADMIN_PASSWORD`**.
2. Gera certificado autoassinado (SAN: `pdv.local`, `localhost`, `127.0.0.1`) em `deploy/certs/`, válido 10 anos.
3. Sobe `db` + `restaurante` com `docker compose up -d --build` (força `DATABASE_URL` apontando para `db:5432`).
4. Gera `zeldapdv.conf` em `/etc/nginx/sites-enabled/`, roda `nginx -t` e recarrega.

Acesse `https://pdv.local` (adicione `pdv.local 127.0.0.1` ao `/etc/hosts` se quiser o hostname, e aceite o aviso do certificado autoassinado).

## Uso na VPS com subdomínio (Let's Encrypt real)

1. Libere as portas no firewall: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`.
2. Aponte o DNS do subdomínio para o IP da VPS **antes** de rodar (o certbot valida o domínio).
3. Instale certbot: `sudo apt install -y certbot python3-certbot-nginx`.
4. Rode:

```bash
CERT_MODE=letsencrypt \
DEPLOY_DOMAIN=pdv.seudominio.com \
LETSENCRYPT_EMAIL=voce@seudominio.com \
./deploy/deploy.sh
```

O certbot emite o certificado via plugin `--nginx` (o site já está publicado) e a renovação automática fica por conta do systemd timer (`certbot renew`).

## Variáveis configuráveis

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEPLOY_DOMAIN` | `pdv.local` | hostname servido (use o subdomínio na VPS) |
| `CERT_MODE` | `selfsigned` | `selfsigned` (local) ou `letsencrypt` (VPS) |
| `LETSENCRYPT_EMAIL` | — | obrigatório em `letsencrypt` |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | portas do nginx |
| `APP_PORT` | `3000` | porta do container da aplicação |
| `CERT_DIR` | `deploy/certs` | pasta do autoassinado |
| `NGINX_SITES` | `/etc/nginx/sites-enabled` | onde gravar o site |

## Dicas e avisos

- **White label**: `NEXT_PUBLIC_*` são embutidas no build. Altere no `.env` e rode `docker compose build restaurante` (o `deploy.sh` já faz `--build`).
- **Nunca** reverter a migração `pedidos_web_status_check` para `DROP + ADD` separados (concorrência → `42710`). Ver `STABLE-VERSION.md` §4.
- Porta `3000` do app fica exposta no host. Em produção estrita, rode `docker compose` com a porta do app limitada a `127.0.0.1:3000:3000` (o nginx acessa via `127.0.0.1`).
- Backup do banco: `docker compose exec db pg_dump -U zelda zeldapdv > backup.sql`.
