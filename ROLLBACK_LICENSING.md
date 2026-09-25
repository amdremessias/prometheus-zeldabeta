# ROLLBACK — Sistema de Licenciamento (JWT Assimétrico)

> Documento de segurança criado ANTES de implementar a arquitetura de licenciamento.
> O repositório **não é um git repo** (deploy por imagem Docker + tarball), portanto o
> rollback depende de: (1) **imagem Docker fixada** e (2) **dump do PostgreSQL**.

---

## 1. Baseline conhecido (estado estável atual)

- **Versão da aplicação:** `ZeldaPDV V.1.11.10-base-build-29082026`
- **Imagem Docker atual:** `restaurante-tech-main-zeldapdv-crm-zeldapdv:latest`
- **Container CRM:** `restaurante-zeldapdv-crm` (publicado em `:3013`)
- **Container DB:** `restaurante-zeldapdv-postgres` (postgres:16, volume `restaurante_zeldapdv_pgdata`, porta host `5444`)
- **Compose:** `docker-compose-zeldapdv.yml`
- **Volumes persistentes:** `restaurante_zeldapdv_pgdata` (banco), `restaurante_zeldapdv_backups` (`/backups`), `restaurante_zeldapdv_branding`, `restaurante_zeldapdv_n8n_data`
- **Auth atual:** sessão JWT simétrica `HS256` (`JWT_SECRET`) em `src/lib/auth-core.ts`; middleware em `src/middleware.ts`. **Não existe** still nenhum conceito de licença/tenant.
- **n8n / WAHA:** não são afetados pela licença (mantidos fora do escopo de rollback).

---

## 2. CHECKLIST OBRIGATÓRIO ANTES de começar (gera os artefatos de rollback)

Execute **antes** de qualquer alteração de código. Se pular isto, não haverá rede de segurança.

```powershell
# 2.1 Fixar a imagem atual (artefato de rollback de app)
#     (já executado na implantação da licença — baseline fixado:)
#     crm-zeldapdv:rollback-baseline-29082026

docker tag restaurante-tech-main-zeldapdv-crm-zeldapdv:latest `
            crm-zeldapdv:rollback-baseline-29082026
# 2.2 Backup do banco (host + dentro do volume /backups para persistir)
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
docker exec restaurante-zeldapdv-postgres sh -c "pg_dump -U zelda zeldapdv" `
  > "zeldapdv-pre-licensing-$stamp.sql"
docker exec restaurante-zeldapdv-postgres sh -c "pg_dump -U zelda zeldapdv > /backups/zeldapdv-pre-licensing-$stamp.sql"

# 2.3 Salvar .env atual (sem variáveis de licenciamento) como referência
Copy-Item .env "env-pre-licensing-$stamp.bak"
```

Confirme:
- `docker images | Select-String pre-licensing` mostra a imagem fixada.
- `zeldapdv-pre-licensing-*.sql` existe e tem tamanho > 0.
- `env-pre-licensing-*.bak` existe.

> No Windows/Powershell o `docker exec ... > arquivo` grava no diretório corrente do host.
> O dump em `/backups` sobrevive a recriação de containers (volume persistente).

---

## 3. O que a implementação de licenciamento VAI tocar (para saber o que reverter)

| Camada | Arquivo(s) | Tipo de mudança | Reversão |
|---|---|---|---|
| Auth/verify | `src/lib/auth-core.ts` | adiciona `verifyLicenseToken` (Ed25519) — **não remove** o existente | remover funções novas |
| Licenciamento | `src/lib/server/licensing.ts` (NOVO) | lógica de validação (exp/grace/revogação/tenant) | deletar arquivo |
| Middleware | `src/middleware.ts` | adiciona checagem de licença em `/app` e `/api` | restaurar conteúdo atual (ver Anexo A) |
| Rotas | `src/app/api/license/*` (NOVAS: `status`, `emergency`) | endpoints de licença | deletar pasta |
| Tela de bloqueio | `src/app/license/*` ou modal em `AppRouter` (NOVO) | tela "Licença expirada" + botão emergencial | remover |
| Banco | `instance_license`, `license_revocations` (NOVAS tabelas) | migração SQL | `DROP TABLE` (ver §5) |
| Env | `LICENSING_PUBLIC_KEY`, `MASTER_API_TOKEN`, `INSTANCE_CLIENT_ID`, `INSTANCE_DOMAIN`, (opcional) `LICENSING_REDIS_URL` | novas vars | remover do `.env` |
| Compose | `docker-compose-zeldapdv.yml` | (só se adicionar Redis) | remover serviço redis |

> Decisão de risco: **revogação usa Postgres** (`license_revocations`), não Redis, para
> não introduzir nova infraestrutura. Redis fica como otimização futura. Assim o rollback
> de banco é apenas `DROP TABLE`.

---

## 4. ROLLBACK RÁPIDO (app voltando ao baseline, banco intacto)

Use quando o problema for só de código/compilação e o banco ainda não foi migrado.

```powershell
# 4.1 Remover variáveis de licenciamento do .env (voltar ao .env do backup)
Copy-Item env-pre-licensing-*.bak .env -Force   # ou editar manualmente removendo LICENSING_*/MASTER_API_TOKEN/INSTANCE_*

# 4.2 Apontar o compose para a imagem fixada (em vez de rebuildar do fonte alterado)
#     Editar docker-compose-zeldapdv.yml: no serviço crm-zeldapdv, substituir o bloco
#     `build: { context: ., dockerfile: Dockerfile, args: {...} }`
#     por:  image: crm-zeldapdv:rollback-baseline-29082026
#     (mantenha o resto: container_name, ports, environment, volumes, depends_on, networks)

# 4.3 Subir com a imagem estável
docker compose -f docker-compose-zeldapdv.yml up -d crm-zeldapdv
```

Verificação: `http://localhost:3013/login` → 200 e o app abre sem tela de licença.

---

## 5. ROLLBACK COMPLETO (inclui banco migrado)

Use se as migrações de licenciamento já rodaram e precisam sumir.

```powershell
# 5.1 Rollback de app (§4.1 a §4.3)

# 5.2 Remover tabelas criadas pela migração de licenciamento
docker exec -i restaurante-zeldapdv-postgres psql -U zelda -d zeldapdv -c @"
DROP TABLE IF EXISTS license_revocations;
DROP TABLE IF EXISTS instance_license;
"@

# 5.3 (Opcional) Se Redis foi adicionado ao compose, removê-lo e subir sem ele
docker compose -f docker-compose-zeldapdv.yml up -d crm-zeldapdv
```

Se preferir restaurar o banco inteiro a partir do dump (cenário de corrupção):

```powershell
# CUIDADO: isto sobrescreve TODAS as tabelas com o estado do dump.
docker exec -i restaurante-zeldapdv-postgres psql -U zelda -d zeldapdv < zeldapdv-pre-licensing-YYYYMMDD-HHMM.sql
```

---

## 6. Rollback de imagem "esquecida" (tag perdido)

Se a imagem `pre-licensing` foi apagada, rebuild a partir do **tarball estável** anterior:

```powershell
# O tarball de V.1.11.10 foi gerado em scripts/ (make-stable-release.sh) e contém
# src + Dockerfile + compose. Extraia e rebuild:
#   tar -xzf zeldapdv-stable-1.11.10-*.tar.gz
#   docker compose -f docker-compose-zeldapdv.yml build crm-zeldapdv
#   docker compose -f docker-compose-zeldapdv.yml up -d crm-zeldapdv
```

---

## 7. Verificação pós-rollback

- [ ] `http://localhost:3013/login` responde 200.
- [ ] Login de admin funciona (`ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env`).
- [ ] `/app` abre sem redirecionar para tela de licença.
- [ ] `docker compose -f docker-compose-zeldapdv.yml ps` mostra `crm-zeldapdv` e `db-zeldapdv` healthy.
- [ ] n8n (`:5688`) e WAHA continuam operacionais (não tocados).
- [ ] `SELECT count(*) FROM instance_license;` retorna erro "tabela não existe" (rollback completo) — esperado.

---

## Anexo A — Conteúdo exato atual de `src/middleware.ts` (restaurar se necessário)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth-core';
const PUBLIC_API_PREFIXES = ['/api/auth/login','/api/auth/logout','/api/cardapio-digital','/api/integrations/whatsapp/order','/api/whatsapp/inbound','/api/whatsapp/human','/api/whatsapp/order','/api/entregas','/api/whatsapp/feedback','/api/branding/config','/api/branding/presets','/api/branding/logo','/api/branding/selo','/api/v1/crm/chat-status','/api/v1/crm/conversations/check-in','/api/v1/menu-link','/api/v1/orders/status','/api/v1/sac/tickets','/api/v1/handoff'];
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    return NextResponse.next();
  }
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    if (!user) { const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; return NextResponse.redirect(url); }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/app/:path*','/api/:path*'] };
```

> Sem git, este anexo é a única cópia "textual" do middleware pré-licenciamento.
> Mantenha este arquivo junto do backup do banco.
