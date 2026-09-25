# Versão Estável — Snapshot de referência

> **Data do snapshot:** 2026-08-31
> **Versão do sistema:** `ZeldaPDV V.1.11.14-import-31082026` (constante `SYSTEM_VERSION` em `src/shared/lib/version.ts`, exibida na aba Backup)
> **Propósito:** congelar o estado estável validado do sistema para que qualquer mudança futura não o quebre. **Não altere** estas regras sem atualizar este arquivo.
> **Repo:** ainda não é um repositório git — antes de levar para a VPS, rode `git init` (ver seção 9).

---

## 1. O que é "estável" nesta versão

Todas as fases 1–5 e os ajustes complementares concluídos, **validados** com:

- `npx tsc --noEmit` → **verde**
- `npm run lint` (eslint src) → **exit 0**
- `npm run build` (Next standalone) → **exit 0** ("Compiled successfully")
- Smoke tests server-side (seção 5) → **passaram**, banco restaurado após cada teste.

---

## 2. Stack pinada (não atualizar sem teste completo)

| Camada | Versão (pinned) | Nota |
|--------|-----------------|------|
| Node (imagem Docker) | **22 LTS** (alpine) | `Dockerfile` stages `deps/builder/runner` |
| Next.js | **16.1.6** | App Router + Turbopack (dev) / `output: "standalone"` (prod) |
| React / React DOM | **19.2.4** | |
| TypeScript | ^5 | `tsconfig.json` |
| Tailwind CSS | ^4 (`@tailwindcss/postcss`) | remapeia `green-*` via `NEXT_PUBLIC_BRAND_COLOR` |
| Postgres | **16** (`postgres:16-alpine`) | via Docker Compose |
| `pg` (cliente) | ^8.23.0 | |
| `jose` (JWT) | ^6.2.8 | cookie httpOnly `zpdv_session` (7d) |
| `bcryptjs` | ^3.0.3 | hash de senha |
| `zustand` | ^5.0.11 | estado cliente |
| `idb` | ^8.0.3 | IndexedDB |
| `lucide-react` | ^0.576.0 | ícones |
| Radix UI | react-dialog/label/select/slot/switch/tabs ^1.x | |

### Portas padrão

| Serviço | Porta | Local |
|---------|-------|-------|
| App Next.js (standalone) | `3000` (host:container 3000:3000) | `http://127.0.0.1:3000` |
| Postgres | host `5434` → container `5432` | dev local + compose |
| nginx (reverse proxy + TLS) | `80` / `443` | via `deploy/deploy.sh` |

---

## 3. Rotas atuais (não renomear sem migração de links/PWA)

### Páginas (`src/app`)
- `/` — landing; `/login` — autenticação; `/app` — dashboard completo; `/demo` — modo demonstração (nunca escreve no servidor); `/m/[slug]` — **cardápio digital público**.

### APIs (`src/app/api`)
| Rota | Métodos | Nota |
|------|---------|------|
| `/api/auth/login` | POST | cria cookie `zpdv_session` |
| `/api/auth/logout` | POST | limpa cookie |
| `/api/auth/me` | GET | sessão |
| `/api/state` | GET/PUT | snapshot JSONB em `app_state` (id=1) — dispara `ensureSchema` |
| `/api/caixa` | GET/POST | abrir/fechar caixa; POST `/api/caixa/fechar` |
| `/api/caixa/historico` | GET | fechamentos |
| `/api/pedidos-web` | GET | lista pedidos do cardápio digital (com `faturado`) |
| `/api/pedidos-web/[id]` | PATCH | muda status; aceita `'cancelado'` |
| `/api/cardapio-digital/[slug]` | GET/POST | cardápio público + criação de pedido |
| `/api/users` | GET/POST | usuários |
| `/api/users/[id]` | PATCH/DELETE | |
| `/api/users/[id]/password` | PATCH | |
| `/api/users/me/password` | PATCH | |

Middleware: rotas `api/*` exigem JWT (exceto públicas), proxy/middleware em `src/middleware.ts`.

---

## 4. Schema do banco (Postgres) — snapshot

Migrações gerenciadas por `ensureSchema()` (`src/lib/server/db.ts`): `SCHEMA_SQL` (idempotente, `CREATE TABLE IF NOT EXISTS`) + `MIGRATIONS_SQL` (aditivas). **Regra:** qualquer coluna/tabela nova vai nas duas listas; migrações nunca destroem dados.

```sql
users(id SERIAL PK, name TEXT, email TEXT UNIQUE, password_hash TEXT,
      role TEXT DEFAULT 'admin', active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ)

app_state(id INT PK CHECK (id = 1), data JSONB, updated_at TIMESTAMPTZ)  -- linha única

caixa(id SERIAL PK, status CHECK(aberto|fechado), opened_at, opened_by FK users,
      initial_amount NUMERIC(12,2), closed_at, closed_by, expected_amount,
      final_amount, difference, sales_count, notes, detail JSONB)

pedidos_web(id SERIAL PK, slug, cliente, telefone, endereco, pagamento,
      taxa_entrega_nome, taxa_entrega_valor NUMERIC(12,2), itens JSONB,
      subtotal, total, status CHECK(pendente|em_preparo|concluido|cancelado),
      origem TEXT NOT NULL DEFAULT '',  -- 'cardapio_digital' identifica pedidos do cardápio público
      status_entrega TEXT NOT NULL DEFAULT 'aguardando'
        CHECK(aguardando|retirada_confirmada|em_entrega|entregue|recebido),
      entregador TEXT NOT NULL DEFAULT '', entregador_telefone TEXT NOT NULL DEFAULT '',
      observacoes TEXT NOT NULL DEFAULT '', carteira_fiado BOOLEAN NOT NULL DEFAULT FALSE,
      recebido BOOLEAN NOT NULL DEFAULT FALSE,
      retirada_confirmada_at TIMESTAMPTZ, saiu_entrega_at TIMESTAMPTZ,
      entregue_at TIMESTAMPTZ, recebido_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      faturado BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ)
```

**Migração crítica atual:** constraint `pedidos_web_status_check` inclui `'cancelado'`. Ela é aplicada de forma **atômica** (bloco `DO $$ ... LOCK TABLE pedidos_web IN ACCESS EXCLUSIVE MODE ... $$`) para ser concorrência-safe com as múltiplas instâncias do turbopack dev. Não reverter para `DROP + ADD` separados (causa `42710 constraint already exists` sob concorrência).

---

## 5. Smoke tests validados (guardar como prova de estabilidade)

1. **Recebimento parcial (mesa/PDV/delivery):** venda R$ 225 em 4 parcelas (50 Pix + 100 Dinheiro + 50 Fiado + 25 Cartão) → fechamento `expected = 100 (inicial) + 225 = 325`, `salesCount = 1`, `detail` preserva os 4 `pagamentos`, transações de entrada somam 225. Banco restaurado.
2. **Cancelamento de pedido web:** 6/6 checks — login → `/api/state` → constraint permite `'cancelado'` → PATCH `'cancelado'` → GET inclui `faturado` → pedido cancelado **não** entra no faturamento (`status='concluido' AND faturado=false`) → cleanup.
3. **Fluxo de entregas:** atribuir entregador → "Em Andamento" (aguardando recebimento) → cancelamento de entrega remove também o pedido da cozinha.

Para reexecutar: `npx tsc --noEmit`, `npm run lint`, `npm run build`, e os scripts de teste em `C:\Users\m3ss14s\AppData\Local\Temp\opencode\zpdv-cancel-test.js`.

---

## 6. Invariantes que NÃO podem ser quebrados (resumo de SISTEMA.md §4.4)

1. **Venda exige caixa aberto** — server 403 + guardas em PDV, mesas, delivery, takeout, contabilidade.
2. **Fiado exige cliente com `carteiraHabilitada`**; débito via `LancarFiado`; cancelamento de venda reverte fiado com movimentação `credito` de valor negativo.
3. **Fechamento de caixa** grava `detail = { vendas, transacoes }` e bloqueia novas vendas.
4. **Persistência** = snapshot inteiro em `app_state`; imagens viram `dataURL` via `stateSerializer`; nunca armazenar `Blob` cru.
5. **Demo** nunca escreve no servidor.
6. **Tipos globais** são globais (sem `import`).

---

## 7. Variáveis de ambiente (env)

| Variável | Uso | Padrão |
|----------|-----|--------|
| `NEXT_PUBLIC_BRAND_NAME` | white label (build-time) | `Zelda PDV` |
| `NEXT_PUBLIC_BRAND_DESCRIPTION` | SEO/landing (build-time) | — |
| `NEXT_PUBLIC_BRAND_LOGO` | logo path (build-time) | `/logo.svg` |
| `NEXT_PUBLIC_BRAND_COLOR` | cor de marca (build-time) | `#16a34a` |
| `NEXT_PUBLIC_BRAND_FOOTER` | rodapé (build-time) | — |
| `DATABASE_URL` | runtime | compose: `postgresql://zelda:zelda@db:5432/zeldapdv`; dev local: `localhost:5434` |
| `JWT_SECRET` | runtime | `dev-secret-zeldapdv-food` (trocar em produção!) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin padrão (1º login) | `adm@zeldapdv.lab` / `admin123` |

> As `NEXT_PUBLIC_*` são **embutidas no build** (Docker ARG). Alterou → reconstruir imagem.

---

## 8. Como reconstruir a versão estável

```bash
# local (dev)
npm ci && npm run dev          # http://localhost:3000 (ou 3003 com -p)

# validação (gates de estabilidade)
npx tsc --noEmit && npm run lint && npm run build

# docker (produção local)
docker compose up -d --build db restaurante
```

**Deploy completo com nginx + TLS:** `deploy/deploy.sh` (ver `deploy/README.md`).

---

## 9. Futuro: hospedagem em VPS com subdomínio

Fluxo planejado (ver `deploy/README.md` para passos completos):

1. `git init` no projeto e subir para um repo (ex.: GitHub).
2. Na VPS: clonar, criar `.env` (trocar `JWT_SECRET`, `ADMIN_PASSWORD`).
3. Liberar portas `80`/`443` no firewall.
4. `CERT_MODE=letsencrypt DEPLOY_DOMAIN=pdv.seudominio.com LETSENCRYPT_EMAIL=voce@dominio.com ./deploy/deploy.sh`
5. Apontar DNS do subdomínio para o IP da VPS **antes** de emitir o certificado.

---

## 10. Registro de mudanças (append-only)

| Data | Mudança | Validado |
|------|---------|----------|
| 2026-08-11 | Snapshot inicial da versão estável | tsc + lint + build + smoke tests |
| 2026-08-11 | **Revisão de segurança** (ver `SECURITY.md`): rate limit em login/senha/cardápio, permissões server-side em caixa/pedidos-web, `JWT_SECRET` obrigatório em produção, sem vazamento de senha padrão no GET de login, validação de email/tamanhos, `imageData` validada no servidor (MIME+2.5MB), upload client-side valida MIME+2MB, security headers no `next.config.ts`, `.gitignore` cobre `deploy/certs/`. | tsc + lint + build + smoke test segurança (15/15) |
| 2026-08-11 | **Correção fluxo de entregas** (`DeliveryCard.tsx`): selecionar entregador cadastrado não movia o pedido para "Em Andamento" porque o `<select>` enviava string e o `find` comparava `===` com `number`. Agora o valor é convertido com `Number(v)` no `onChange`. | tsc + lint |
| 2026-08-11 | **Impressão de relatórios de caixas anteriores** (`CaixaScreen.tsx`, `shared/lib/caixaReportPrint.ts`, `printReceipt.ts`): botão "Imprimir" na tabela de histórico e dentro do relatório (mantendo "Ver relatório"); `printReceipt` agora aceita `bodyHTML` customizado; resumos do relatório extraídos para `computeCaixaReport` (usado na tela e na impressão, formato 72mm). | tsc + lint + build |
| 2026-08-11 | **Gestão de itens em mesas/cartão** (`MenuCart.tsx`, `menuCartActions.ts`, novo `POST /api/auth/verify-password`, `FoodCartType.transferOrigin`): (1) excluir item lançado exige senha de usuário com permissão `mesas` (validada no servidor com bcrypt + rate limit 5/min) e motivo; se o item estava na cozinha, também é removido do pedido; (2) transferir item entre mesas adiciona a tag "Origem" (nome da mesa de origem) no item transferido — `inCart`/`inKitchen` → `inCart` do destino, `alreadyEaten` → `alreadyEaten` do destino. | tsc + lint + build |
| 2026-08-11 | **Impressão de pedidos da cozinha** (`KitchenCard.tsx`, `kitchenActions.ts`, `printReceipt.ts`): botão "Imprimir" em cada pedido da cozinha gera o ticket (tipo, mesa/cliente, cozinheiro, hora, itens com observações, subtotal, taxa e total) em formato 72mm; `ReceiptItem` agora aceita `note` para observações. | tsc + lint + build |
| 2026-08-12 | **Correção: imagens de produtos sumiam após F5** (`src/store/userStore.ts`, `src/shared/lib/stateSerializer.ts`): o middleware `persist` do zustand serializa o estado com `JSON.stringify` antes de chamar o `setItem`, o que destruía os `Blob` de imagem (viravam `{}`) e fazia `serializeStateForServer` sempre enviar `imageData` vazio ao servidor — a imagem aparecia em memória mas sumia ao recarregar. Agora a serialização usa o estado vivo em memória (`useDataStore.getState()`) e `blobToDataURL` trata `Blob` vazio (size 0) como sem imagem. | tsc + lint + build |
| 2026-08-12 | **Deploy multi-cliente (`deploy/multi-client/` + `deploy/ROLLBACK.md`)**: modelo de 1 stack docker (app + Postgres) por cliente servido pelo nginx do host via subdomínio wildcard `*.internal.lab` com TLS autoassinado; `install.sh` (1x/VPS: estrutura + wildcard), `add-client.sh` (idempotente: porta via registry, `.env` com segredos únicos random, build da imagem `zeldapdv:<cliente>` com `NEXT_PUBLIC_*`, compose `-p <cliente>`, conf nginx + reload), `remove-client.sh` (com `--purge`), `backup-client.sh` (pg_dump gzip), `list-client.sh`; `.gitignore`/`.dockerignore` cobrem `clients/` e `backups/`. Sem mudanças no código do app. | sintaxe bash (`bash -n`) + teste funcional de validação/registry/render dos templates |
| 2026-08-26 | **Cardápio Digital — consentimento, cadastro e modo de entrega:** `POST /api/cardapio-digital/[slug]` agora valida `aceitePrivacidade` (obrigatório) e `cadastroCliente` (`sim`/`nao`/`existente`); em `'sim'` registra o cliente em `upsertClienteWhatsapp` com observação `Novo Cliente - Cardápio Digital`. O `modoEntrega` (entrega/retirada) é derivado da taxa selecionada e o endereço passa a ser obrigatório para entrega. `createPedidoWeb` grava a coluna `origem='cardapio_digital'`. | tsc + lint + build + testes E2E (POST cardápio, fluxo Cozinha→Entregas) |
| 2026-08-26 | **Fluxo Cozinha → Entregas/Retirada (com entregador obrigatório):** `PedidosWeb.tsx` (aba Cozinha) passou a buscar também pedidos `em_preparo` e mantém o card visível até `Concluir` (corrige travamento em `em_preparo` que impedia o pedido de chegar às Entregas). `WebDeliveryOrders.tsx` exige entregador no PATCH `em_entrega` (retorna 400 sem nome) e exibe a tag "Cardápio Digital" quando `origem='cardapio_digital'`. | tsc + lint + build + testes E2E (PATCH sem/comp entregador → 400/ok) |
| 2026-08-26 | **Versão do sistema na aba Backup:** constante `SYSTEM_VERSION = 'ZeldaPDV V.1.3.2-base-build-26082026'` em `src/shared/lib/version.ts`, exibida no topo de `SettingsBackup.tsx`. | tsc + lint + build |
| 2026-08-26 | **Correção do menu lateral da Demonstração:** `SidebarNav.tsx` exibe TODOS os `navItems` quando `isDemo` (antes ocultava tudo porque `can(undefined, perm)` era `false`), então o revisor básico vê PDV, Cardápio, Cozinha, Entregas etc. no modo demo. | tsc + lint + build + `/demo` → HTTP 200 |
| 2026-08-26 | **Pacote de atualização para VPS (preserva banco):** `scripts/make-stable-release.sh` gera o tarball `zeldapdv-stable-1.3.2-base-build-26082026-*.tar.gz` (exclui `node_modules`/`.git`/`.next`/`.env`); `scripts/vps-update.sh` reconstrói só o container `crm-zeldapdv` mantendo o volume `restaurante_zeldapdv_pgdata`. Migrações (`ensureSchema`) rodam automaticamente na subida. | tarball gerado (12,3 MB, 372 entradas) + `bash -n` nos scripts |
| 2026-08-29 | **Refatoração de categorias (ID) + Observações por item + PDV→Cozinha + Cardápio Digital:** `category` dos produtos passou de `string[]` (rótulos) para `number[]` (IDs de `categorias`); filtros de PDV/Cardápio/MenuGrid/delivery e o cardápio público passam a agrupar por ID; `SettingsMenu` usa checklist multi-seleção por ID e `recalcCategoriaCounts` recalcula `qtdItems`; `stateSerializer` migra dados legados (rótulos→IDs) ao carregar. Observações (`notes`) adicionadas por item no PDV, Cardápio interno, delivery, cozinha (card+impressão) e relatório; PDV agora envia os itens para a cozinha (tipo `pdv`). Cardápio Digital (`/m/[slug]`) recebe campo de observação por produto, enviado ao `createPedidoWeb` e exibido na tela de Pedidos. Versão do sistema `ZeldaPDV V.1.11.11-base-build-29082026`. | tsc + lint + build + container reconstruído (porta 3013) |
| 2026-08-29 | **Correção de segurança (auditoria 5 categorias):** 8/9 achados resolvidos — JWT_SECRET agora obrigatório em produção (fallback só em dev) e role padrão não é mais `admin` (auth-core.ts); `PUT /api/state` exige `can(role,'config')`; `checkWebhookSecret` fail-closed; `GET/PUT /integrations/whatsapp/settings` exigem sessão (+`integracoes` no PUT); `OperationalReportPrints` escapa campos do cliente (XSS); removidos defaults inseguros de `JWT_SECRET`, `ADMIN_*`, `WAHA_API_KEY`, `ZELDAPDV_WEBHOOK_SECRET` e `BOT_API_TOKEN` no compose (valores fornecidos via `.env`). Aberto residual: chave WAHA ainda embutida em `docker-compose-fixed.yml`, `docker-build-crm.yml` e `n8n/*.json` (não revogada). Versão do sistema `ZeldaPDV V.1.11.12-security-29082026`. | tsc + next build + containers reconstruídos |
| 2026-08-31 | **Módulo Fiscal (NFC-e/NF-e), códigos de produto e busca rápida no PDV:** Fase 1–3 do módulo fiscal (UI + Data Layer, sem envio real à SEFAZ) com toggle `habilitado` padrão OFF em Configurações > Fiscal, permissão `fiscal`, `src/lib/server/fiscalCrypto.ts`+`FISCAL_ENCRYPTION_KEY`, endpoints `/api/fiscal/config`, `/api/fiscal/notes`, `/api/fiscal/emitir` (simulado/pendente, chave 44 dígitos), `/api/fiscal/notes/[id]/cancelar|xml`, `/api/fiscal/exportar-mes`, tab Fiscal + `FiscalNotesScreen`, container separado `fiscal-zeldapdv` (`fiscal/Dockerfile`+`index.php`, gated por `profiles:["fiscal"]`). PDV/Produtos: correção da proporção do modal de cadastro de produto (3 colunas+scroll), campos novos `codigoBarras` e `codigoInterno` em `CardapioFoodType`+`stateSerializer`+modais de criar/editar; busca no PDV localiza por descrição/código interno/código de barras com atalho de leitor (Enter adiciona direto quando o produto não tem adicionais); aba Cardápio busca também por código interno. Versão do sistema `ZeldaPDV V.1.11.13-fiscal-31082026`. | tsc + next build + container reconstruído (porta 3013) |
| 2026-08-31 | **Importação de Produtos via CSV (aba "Importar Produtos"):** nova aba em Configurações para cadastro em massa de itens do cardápio a partir de CSV, sem dependências. `src/shared/lib/parseProductCsv.ts` (parser puro: separador `;`/`,`, aspas, BOM, preço BR `12,50`/`12.50`, auto-mapeamento de cabeçalhos por alias, `MODELO_HEADERS`, `gerarModeloCsv`/`baixarModeloCsv` para template com 3 exemplos) + `src/modules/settings/SettingsImportProdutos.tsx` (upload `.csv`, seletor de separador, prévia com erros por linha, modelo/guia de preenchimento, importação em lote). Aplicação puramente **aditiva** via `setCardapio` + `recalcCategoriaCounts` (IDs com `encontrarMenorIdDisponivel`) — não sobrescreve produtos existentes; persiste no Postgres pelo mesmo caminho do cadastro manual (`persist`→`serializeStateForServer`→`PUT /api/state`) e aparece em Cardápio/PDV/Cardápio Digital. Versão do sistema `ZeldaPDV V.1.11.14-import-31082026`. | tsc + next build + round-trip do modelo em Node + container reconstruído (porta 3013) |

