# Security Model — Zelda PDV

> Última atualização: 2026-08-11  
> Escopo: documenta decisões de segurança, arquitetura de autenticação/autorização, validações e limites.  
> **Não substitua este arquivo** sem revisão de segurança; alterações devem ser registradas no final (changelog).

---

## 1. Modelo de ameaça & Premissas

- **Single-tenant**: uma instância = um estabelecimento. Não há isolamento multi-tenant no banco.
- **Autenticação**: JWT em cookie httpOnly (`zpdv_session`, 7 dias, `SameSite=lax`, `Secure` em produção).  
  Assinado com `JWT_SECRET` (HS256). **Obrigatório em produção** — a aplicação falha ao iniciar se não estiver definido.
- **Autorização**: RBAC simples (roles: `admin`, `gerente`, `caixa`, `garcom`, `cozinha`, `entregador`). Permissões declaradas em `src/lib/permissions.ts`.
- **Banco**: PostgreSQL 16, conexão única via `DATABASE_URL`. Credenciais só no ambiente do container (`.env` — **não versionado**).
- **Frontend**: Next.js 16 App Router, React 19. Código cliente **não tem segredos**; apenas variáveis `NEXT_PUBLIC_*` (white label) embutidas no build.
- **Deploy**: Docker Compose (app + Postgres). Opcional: nginx reverse proxy + TLS (autoassinado local / Let's Encrypt VPS).

---

## 2. RLS (Row Level Security) — por que NÃO está habilitado

O Postgres roda como **um único usuário de aplicação** (`zelda`). As tabelas não têm coluna de `owner_id`/`tenant_id` — o modelo é single-tenant. Habilitar RLS exigiria:

1. Políticas `USING (true)` (no-op) ou
2. `SET LOCAL app.current_user_id` a cada request + role restrita + `FORCE ROW LEVEL SECURITY`.

Opção 2 adiciona complexidade operacional (duas roles, `SET LOCAL` em cada query, migração de dados) sem ganho real de isolamento — a aplicação já valida **toda permissão no servidor** (ver seção 3). Portanto:

> **RLS está desabilitado intencionalmente.**  
> Defesa em profundidade: queries **sempre parameterizadas** (`$1`, `$2`...), usuário DB com privilégios mínimos (`INSERT/UPDATE/SELECT` nas tabelas do app), e **autorização no layer da aplicação** (cada handler checa JWT + role antes de tocar no banco).

Se no futuro houver necessidade multi-tenant, a arquitetura exigirá redesign (RLS + colunas de tenant + roles por tenant).

---

## 3. Autorização — server-side first

| Camada | O que faz |
|--------|-----------|
| **Middleware** (`src/middleware.ts`) | Bloqueia `/api/*` sem JWT (exceto `/api/auth/login`, `/api/auth/logout`, `/api/cardapio-digital`). Redireciona `/app` sem sessão para `/login`. |
| **Handlers** (`src/app/api/**/route.ts`) | **Revalidam** a sessão via `getSessionUser()` + checam permissão explícita (`can(role, 'perm')`) antes de qualquer operação sensível. Não confiam só no middleware. |

### Permissões por endpoint (resumo)

| Endpoint | Auth | Permissão necessária |
|----------|------|----------------------|
| `GET/POST /api/auth/login` | público | — |
| `POST /api/auth/logout` | público | — |
| `GET /api/auth/me` | JWT | — (revalida `active` no DB) |
| `GET/PUT /api/state` | JWT | — (PUT exige caixa aberto se houver novas transações) |
| `GET/POST /api/caixa` | JWT | `caixa_abrir_fechar` |
| `POST /api/caixa/fechar` | JWT | `caixa_abrir_fechar` |
| `GET /api/caixa/historico` | JWT | — |
| `GET /api/pedidos-web` | JWT | — (qualquer autenticado visualiza cozinha) |
| `PATCH /api/pedidos-web/[id]` | JWT | `cozinha` |
| `GET/POST /api/cardapio-digital/[slug]` | público | — (POST rate-limited 10/min/IP) |
| `GET/POST /api/users` | JWT | `config_usuarios` |
| `PUT/DELETE /api/users/[id]` | JWT | `config_usuarios` (+ auto-proteção) |
| `POST /api/users/[id]/password` | JWT | `config_usuarios` |
| `POST /api/users/me/password` | JWT | — (próprio usuário) |

---

## 4. Validação de Entrada & Sanitização

### Lado servidor (todos os handlers)

- **JSON parsing**: `try/catch` → 400 se inválido.
- **Limites de tamanho** (constantes em `src/lib/server/validation.ts`):
  - `name ≤ 80`, `email ≤ 200` (regex RFC-lite), `password ≤ 128`
  - `phone ≤ 30`, `address ≤ 200`, `notes ≤ 500`
  - `valorInicial / valorFinal ∈ [0, 1_000_000]`
  - `itens ≤ 100` por pedido
  - `state PUT` payload ≤ **25 MB** serializado
- **Image data URLs** (pratos): validados no `PUT /api/state` — apenas `data:image/(png|jpeg|webp|gif);base64,` ≤ **2.5 MB** cada. Payloads com imagem inválida → 400.

### Lado cliente (upload de imagem)

- `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">`
- Validação **antes** de criar Blob: MIME na lista + tamanho ≤ **2 MB**. Arquivo rejeitado → toast de erro, estado limpo.

---

## 5. Rate Limiting

In-memory (fixed window) via `src/lib/server/rateLimit.ts`. Chave = `prefixo:IP`. IPs preferem `x-real-ip` (nginx) → `x-forwarded-for` (primeiro) → `unknown`.

| Endpoint | Janela | Máx req | Retry-After |
|----------|--------|---------|-------------|
| `POST /api/auth/login` | 60 s | 5 | ✓ |
| `POST /api/users/me/password` | 60 s | 5 | ✓ |
| `POST /api/users/[id]/password` | 60 s | 5 | ✓ |
| `POST /api/cardapio-digital/[slug]` | 60 s | 10 | ✓ |

> Em deploy multi-instância (VPS escalável), trocar por Redis (`ioredis` + sliding window). O módulo está isolado para facilitar a troca.

---

## 6. Segredos & Variáveis

| Variável | Onde | Produção |
|----------|------|----------|
| `JWT_SECRET` | Server-only (`auth-core.ts`) | **Obrigatório** — app falha ao iniciar se ausente |
| `DATABASE_URL` | Server-only (`db.ts`, `docker-compose.yml`) | Deve apontar para Postgres interno (`db:5432`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Server-only (`db.ts`) | **Trocar no `.env` antes de expor** |
| `NEXT_PUBLIC_*` | Build-time (Docker ARG / `.env`) | White label apenas — sem segredos |

`.env*`, `deploy/certs/` estão no `.gitignore`. **Nenhuma chave/API key no frontend nem no repositório.**

---

## 7. Headers de Segurança (Next.js)

Configurados em `next.config.ts` → aplicados a **todas** as respostas:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

CSP não aplicado (requer nonces para scripts inline do dark-mode / Turbopack). Pode ser adicionado futuramente com `next-safe-action` ou middleware de nonces.

---

## 8. Cookies de Sessão

- Nome: `zpdv_session`
- `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 7 dias`
- `secure: true` **apenas em produção** (`NODE_ENV=production`)
- Rotação: novo token a cada login; logout limpa (`maxAge: 0`).

---

## 9. Auditoria Rápida (checklist)

- [x] JWT secret obrigatório em produção
- [x] Login rate-limited
- [x] Endpoints de troca de senha rate-limited
- [x] Cardápio digital rate-limited
- [x] `can()` checado em **todos** handlers sensíveis (não só middleware)
- [x] Validação de email + limites de tamanho em users
- [x] Validação numérica (range) em caixa
- [x] Image data URL validada no servidor (MIME + tamanho)
- [x] Upload cliente valida MIME + tamanho antes de Blob
- [x] Nenhum segredo no frontend / repo
- [x] Headers de segurança globais
- [x] Parâmetros SQL sempre parameterizados (`$n`)
- [x] `.env*` + `deploy/certs/` no `.gitignore`

---

## 10. Changelog de Segurança

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-08-11 | Implementação completa: rate limits, validações, auth-core prod guard, permissões server-side, image validation, security headers, documentação | opencode |

---

## 11. Próximos Passos Recomendados

1. **CSP com nonces** — permite `script-src 'self' 'nonce-...'` e elimina inline scripts.
2. **Rate limiter Redis** — se escalar horizontalmente.
3. **Logs de auditoria** — gravar tentativas de login falhas, mudanças de permissão, acesso a relatórios financeiros.
4. **Teste de penetração** — rodar OWASP ZAP ou similar antes de expor na VPS.
5. **Backup criptografado** — `pg_dump` + age/gpg antes de `docker compose down`.