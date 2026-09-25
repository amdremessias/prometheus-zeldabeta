# Sistema — Zelda PDV

> Documento de referência do sistema atual, convenções obrigatórias e plano de implementação das novas features.
> Objetivo: **padronizar rotas, schemas e variáveis-chave** para que as novas features não quebrem o sistema.

---

## 1. Visão geral e arquitetura

| Item | Valor |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Linguagem | TypeScript (strict) |
| Estado global | Zustand (`useDataStore`, `useNavStore`, `popupStore`) |
| Banco | PostgreSQL (driver `pg`, `Pool`) |
| Sessão | JWT (`jose`) em cookie `httpOnly` `zpdv_session` (7 dias) |
| Senha | `bcryptjs` |
| Persistência | Estado inteiro serializado em `app_state.data` (JSONB), debounce de 600 ms via `PUT /api/state` |
| Demo | IndexedDB (`localDatabase` → `gerarDadosRestauranteFake`) — não persiste no servidor |

### Regra de ouro da persistência

O **cliente** é dono do estado (Zustand). Ele grava um snapshot inteiro no servidor. O servidor **não** mantém domínio dos dados de negócio, exceto **caixa** e **usuários** (que são autônomos e autoritativos no banco).

- Qualquer novo dado de negócio deve nascer em `ClientDataType` (e entrar em `restauranteVazio` + `generateData`).
- Qualquer nova ação de escrita que altere estado usa o padrão `setXxx(updater)`.
- Caixa e usuários sempre leem o banco direto (nunca só o estado cliente).

---

## 2. Rotas atuais

### 2.1 Páginas

| Rota | Público? | Descrição |
|---|---|---|
| `/` | sim | Seletor de versão: Demonstração (`/demo`) ou Aplicação real (`/app`) |
| `/login` | sim | Formulário de login (email + senha) |
| `/app` | **protegido** (middleware) | Aplicação real (AppRoot com persistência) |
| `/demo` | sim | Aplicação demo (dados fictícios, IndexedDB) |

### 2.2 APIs

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | pública | Login; seta cookie de sessão |
| GET | `/api/auth/login` | pública | Dica do usuário padrão |
| POST | `/api/auth/logout` | pública | Limpa cookie |
| GET | `/api/auth/me` | JWT | Usuário da sessão atual |
| GET | `/api/state` | JWT | Lê `app_state` (JSONB) |
| PUT | `/api/state` | JWT | Grava snapshot (bloqueia com caixa fechado → 403) |
| GET | `/api/caixa` | JWT | Caixa aberto/último |
| POST | `/api/caixa` | JWT | Abre caixa |
| POST | `/api/caixa/fechar` | JWT | Fecha caixa (calcula esperado; grava `detail` JSONB) |
| GET | `/api/caixa/historico` | JWT | Lista caixas fechados (com `detail`) |
| GET | `/api/users` | JWT + admin | Lista usuários (sem hash de senha) |
| POST | `/api/users` | JWT + admin | Cria usuário |
| PUT | `/api/users/[id]` | JWT + admin | Edita nome/email/papel/ativo |
| DELETE | `/api/users/[id]` | JWT + admin | Desativa usuário (nunca self/último admin) |
| POST | `/api/users/[id]/password` | JWT + admin | Admin redefine senha |
| POST | `/api/users/me/password` | JWT | Usuário troca a própria senha (atual + nova) |

### 2.3 Middleware (`src/middleware.ts`)

- Protege `/app/:path*` (redireciona para `/login`).
- Protege `/api/:path*` exceto prefixos `['/api/auth/login', '/api/auth/logout']`.
- ⚠️ Se a rota do Cardápio Digital for **pública** (`/m/:slug` ou similar), ela e suas APIs precisam ser **excluídas** do middleware (ver seção 7).

---

## 3. Schemas do banco (Postgres)

> Toda criação de schema é **idempotente**: `CREATE TABLE IF NOT EXISTS` + `MIGRATIONS_SQL` com `ALTER TABLE ... IF NOT EXISTS`. **Nunca** remover colunas sem migração.

### `users`
```sql
id SERIAL PRIMARY KEY
name TEXT NOT NULL
email TEXT NOT NULL UNIQUE
password_hash TEXT NOT NULL
role TEXT NOT NULL DEFAULT 'admin'     -- admin | gerente | caixa | garcom | cozinha | entregador
active BOOLEAN NOT NULL DEFAULT TRUE
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `app_state`
```sql
id INT PRIMARY KEY DEFAULT 1          -- sempre id = 1 (linha única)
data JSONB NOT NULL                    -- estado completo do cliente
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
CONSTRAINT single_row CHECK (id = 1)
```

### `caixa`
```sql
id SERIAL PRIMARY KEY
status TEXT CHECK (status IN ('aberto','fechado'))
opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
opened_by INT REFERENCES users(id)
initial_amount NUMERIC(12,2) NOT NULL DEFAULT 0
closed_at TIMESTAMPTZ
closed_by INT REFERENCES users(id)
expected_amount NUMERIC(12,2)
final_amount NUMERIC(12,2)
difference NUMERIC(12,2)
sales_count INT
notes TEXT
detail JSONB                          -- relatório: { vendas, transacoes }
```

### Migrações futuras (padrão a seguir)
```sql
ALTER TABLE <tabela> ADD COLUMN IF NOT EXISTS <coluna> <tipo>;
```

---

## 4. Variáveis-chave

### 4.1 Ambiente (env)

| Variável | Onde | Descrição |
|---|---|---|
| `DATABASE_URL` | servidor | `postgresql://zelda:zelda@localhost:5434/zeldapdv` (dev) / `db` (Docker) |
| `JWT_SECRET` | servidor | Segredo do token; dev: `dev-secret-zeldapdv-food` |
| `ADMIN_EMAIL` | servidor | Email do admin padrão (`adm@zeldapdv.lab`) |
| `ADMIN_PASSWORD` | servidor | Senha do admin padrão (`admin123`) |
| `NEXT_PUBLIC_BRAND_*` | cliente | Branding (nome, descrição, logo, cor, footer) |

### 4.2 Modelo de estado cliente (`ClientDataType`)

```
cardapio            { categorias[], pratos[] }        CardapioFoodType { id, imageBlob, imageURL, title, price, discount?, category[], status }
mesas[]             TablesType { id, status, mesaNome, clienteNome, usedAt, guests, waiter, products{inCart,inKitchen,alreadyEaten} }
cozinha[]           KitchenOrderType { id, type(table|delivery|takeout), ownerId, ownerName, ownerTable, chef, orderItems[], createdAt, startedAt?, endedAt? }
entrega[]           DeliveryType { id, kitchenOrderId?, customer?, address?, phone?, payments{items,total,type,clienteId?,clienteNome?}, deliveryPerson?, deliveryPhone?, items?, startedAt?, dispatchedAt?, deliveredAt? }
config              { geralData{restaurantName,address,phone,email,taxRate,currency}, funcionarios[], entregadores[] }
contabilidade       { resumo[], transacoes[] }         TransactionsType { id, description, amount, type(entrada|saída), date }
clientes[]          ClienteType { id, nome, telefone, email, endereco, observacao?, carteiraHabilitada, saldo, createdAt, movimentacoes[] }
vendas[]            VendaType { id, date, tipo(mesa|delivery|retirada|pdv|pagamento_carteira), origem, cliente?, items[], subtotal, taxa, total, metodo(dinheiro|cartao|pix|fiado) }
caixa               CaixaType { status, openedAt?, openedBy?, initialAmount, closedAt?, expectedAmount?, finalAmount?, difference?, salesCount?, notes?, detail? }
mesaSelecionadaId   number | undefined
deliverySelecionado Omit<DeliveryType,'id'> & { inCart[], type(delivery|takeout) }
```

### 4.3 Nomes e convenções (obrigatórias)

| Padrão | Exemplo |
|---|---|
| Store de domínio | `useDataStore`, `setXxx(updater)` onde updater pode ser valor ou função |
| Store de UI | `useNavStore` (abas), `popupStore` (`showMessage(msg, tipo)`) |
| Actions por módulo | `src/modules/<modulo>/<modulo>Actions.ts` (ex.: `caixaActions.ts`, `clienteActions.ts`) |
| Nome de função de ação | Verbo no infinitivo/imperativo: `AbrirCaixa`, `FecharCaixa`, `RegistrarVenda`, `RecordTransaction`, `LancarFiado`, `createEntregador` |
| Guarda de caixa | `isCaixaAberto()` em `caixaActions`; bloquear vendas client-side **e** no servidor (`PUT /api/state` → 403) |
| Rota de ação | `POST /api/<recurso>/<ação>` (ex.: `/api/caixa/fechar`) |
| Rota de consulta | `GET /api/<recurso>` |
| Handler de API | Sempre try/catch retornando JSON + `export const dynamic = 'force-dynamic'` |
| Tipos globais | `src/types/globalTypes.d.ts` (sem `import`), `auxTypes.d.ts`, `ClientDataType.d.ts`, `userStoreType.d.ts` |
| Sem `any` | Usar interfaces (ex.: `TxRow`, `ServerPrato`, `CaixaRowLike`) |

### 4.4 Regras de integridade já implementadas (não quebrar)

1. **Venda exige caixa aberto** — server 403 + guardas em PDV, mesas, delivery, takeout, contabilidade.
2. **Fiado exige cliente com `carteiraHabilitada`** e lança débito em `LancarFiado` (sem transação própria de caixa; a transação de venda é a do PDV/mesa/delivery).
3. **Fechamento de caixa** grava `detail = { vendas, transacoes }` do dia e bloqueia novas vendas.
4. **Persistência** — snapshot inteiro; `Blob`/`objectURL` de imagens convertidos para `dataURL` (`imageData`) via `stateSerializer`; nunca armazenar `Blob` cru no JSONB.
5. **Demo** nunca escreve no servidor (`isDemo`/`demoMode` ignorados no `apiStorage`).
6. **Tipos globais** são globais (sem `import`); importar tipa `ClientDataType`/`StoreState` quando necessário.

---

## 5. Checklist de "não quebrar" ao adicionar feature

- [ ] Novo campo de estado → adicionar em **todos**: `ClientDataType.d.ts`, `restauranteVazio.ts`, `generateData.ts`, `stateSerializer` (spread automático), `localDatabase.carregarClient` (se necessário).
- [ ] Nova tabela/coluna → `SCHEMA_SQL` + `MIGRATIONS_SQL` idempotente.
- [ ] Nova rota privada → garantir JWT no handler (não confiar só no middleware) + `force-dynamic` + try/catch JSON.
- [ ] Nova rota pública (cardápio digital) → **excluir do middleware** e proteger por token/slug próprio + rate limit.
- [ ] Nova aba → registrar em `navStore.possibleTabs`, `SidebarNav.navItems`, `AppRouter.tabComponents`.
- [ ] Nova tela que vende → chamar `isCaixaAberto()` e registrar `RegistrarVenda`.
- [ ] Validação: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## 6. Análise e plano de implementação das features

> Organizado em fases com dependência. Cada fase termina com `tsc` + `lint` + `build` verdes.

### Fase 1 — Fundação: usuários reais, permissões, logout e tela inicial

**1.1 Cadastro de Usuários editável + troca de senha (admin e usuários)**
- Hoje `SettingsFuncionarios` edita `config.funcionarios` (client-side, sem login). Os **usuários de login** estão em `users` (tabela). Decisão: criar aba **"Usuários"** server-backed em Configurações.
- Backend:
  - `GET /api/users` (listar, sem `password_hash`), `POST /api/users` (criar), `PUT /api/users/[id]` (editar nome/email/role/ativo), `DELETE /api/users/[id]` (desativar, nunca deletar admin/self).
  - `POST /api/users/[id]/password` (admin redefine) e `POST /api/users/me/password` (senha atual + nova).
  - `users` ganha coluna `active BOOLEAN DEFAULT TRUE` (migração) e `role` passa a validar contra níveis (abaixo).
- Frontend: `src/modules/settings/SettingsUsuarios.tsx` (novo, padrão `SettingsFuncionarios`/`SettingsEntregadores`), aba em `SettingsTabs`.
- Troca de senha do admin: mesmo fluxo (`/api/users/me/password`), proteger contra senha padrão.

**1.2 Permissões hierárquicas**
- Roles (nível decrescente): `admin` → `gerente` → `caixa` → `garcom` → `cozinha` → `entregador`.
- Novo arquivo `src/lib/permissions.ts` com mapa de permissões por role:
  - `admin`: tudo.
  - `gerente`: tudo exceto excluir usuários; vê relatórios/financeiro.
  - `caixa`: PDV, mesas, caixa, contabilidade, relatórios.
  - `garcom`: Cardápio, Serviços de Mesa (enviar conta/imprimir), Cozinha; **sem fechar/faturar mesa**, sem Caixa/Configurações/PDV/Financeiro.
  - `cozinha`: apenas Cozinha.
  - `entregador`: apenas Entregas.
- Aplicar em 3 camadas: (1) `SidebarNav` filtra itens; (2) `AppRouter`/telas desabilitam ações; (3) servidor valida role em endpoints sensíveis.
- `SessionUser.role` já viaja no JWT; revalidar no `/api/auth/me` a partir do banco (não só JWT).

**1.3 Perfil Garçom (regra de negócio)**
- Aba "Serviços de Mesa": garçom **não vê** o botão "Fechar conta e liberar mesa" (e não chama `CheckoutCurrentTable`). Mantém "Enviar pedido à cozinha", "Imprimir conta".
- Garçom **não** vê PDV (venda rápida é da caixa).

**1.4 Logout na UI logada (funciona com caixa aberto)**
- `SidebarNav`: botão "Sair" (desktop + mobile) chamando `POST /api/auth/logout` + `router.push('/login')` + `resetNav()`.
- Logout **não** depende de estado de caixa (é só cookie). O caixa aberto permanece no banco (comportamento atual de abertura).

**1.5 Tela inicial (seletor de versão)**
- Reescrever `/` (em `src/app/page.tsx`) com o texto/copy exato fornecido:
  - Card "Demonstração" → `/demo` (copy atual).
  - Card "Aplicação real" → **login** `/login` (não mais direto em `/app`), com bullet list do marketing (Frente de Caixa, Mesas, Delivery, Cardápio Digital `[em desenvolvimento]`).
- Footer: `© 2027 Zelda PDV. Todos direitos reservados. | MCinfraTI`.

---

### Fase 2 — Financeiro: Sangria e Suprimento (caixa aberto)  ✅ concluída

- Na tela Caixa (`CaixaScreen`), quando `status === 'aberto'`, bloco "Movimentações de caixa":
  - **Sangria** (retirada de dinheiro): campo valor + campo **motivo** → transação `type: 'saída'`, descrição `Sangria - <motivo>`.
  - **Suprimento** (entrada de dinheiro): campo valor + campo **motivo** → transação `type: 'entrada'`, descrição `Suprimento - <motivo>`.
- Usa `RecordTransaction` (respeita caixa aberto). Não registra `venda`.
- O esperado no fechamento (`/api/caixa/fechar`) já desconta saídas e soma entradas.
- **Robustez**: o fechamento agora aceita `transacoes` no corpo (além de `vendas`), evitando corrida com o debounce de 600 ms do snapshot.

---

### Fase 3 — Cadastros editáveis (admin)  ✅ concluída

- **Mesas** (`SettingsTables`): Edit abre dialog preenchido e `updateMesa` (renomeia mesa) em `settingsActions`.
- **Produtos/Categorias** (`SettingsMenu`): Edit abre dialog preenchido (nome, preço, desconto, categoria, status, imagem opcional) com `updateProduto`/`updateCategoria`.
- **Entregadores** (`SettingsEntregadores`): Edit abre dialog preenchido e `updateEntregador` (nome/telefone).
- **Funcionários** (`SettingsFuncionarios`): substituído pela aba "Usuários" da Fase 1 (login real). Sem ação.
- **Clientes**: já editável (`ClientesScreen` + `SalvarCliente(id?)`). Nenhuma ação.

---

### Fase 4 — Cardápio Digital (e-commerce + link público)  ✅ concluída

**4.1 Taxas de entrega (config)**
- `GeneralDataType` ganhou `taxasEntrega: TaxaEntregaType[]` (`{ id, nome, valor }`).
- UI em Configurações → Geral ("Taxas de entrega (Cardápio Digital)"): lista + adicionar + remover.
- Atualizados `restauranteVazio`, `generateData`; serializer preserva por spread (`...state`).

**4.2 Tela de geração do link**
- Nova aba Configurações → "Cardápio Digital" (`SettingsCardapioDigital.tsx`): botão "Gerar link" cria slug único (`slugify(nome)-xxxx`) e exibe link clicável/copiável; "Gerar novo link" invalida o anterior.
- Rota pública `/m/[slug]` (server component) — **excluída do middleware** (matcher não inclui `/m`).

**4.3 Página pública (e-commerce)**
- `src/app/m/[slug]/page.tsx` (server) carrega via `loadMenu` (`src/lib/server/cardapioDigital.ts`) e renderiza `CardapioPublico.tsx` (client).
- Cards por categoria, carrinho (drawer), checkout: nome, telefone, endereço, **taxa de entrega** (lista de `taxasEntrega`, inclui "Retirada no local"), pagamento **Dinheiro | Cartão | Pix**, total = subtotal + taxa.
- Imagens vêm como `imageData` (dataURL) do app_state.

**4.4 Ingestão do pedido (cozinha)**
- API pública `POST /api/cardapio-digital/[slug]` (GET também público) com **rate limit** por IP (10/min) e validação; total recalculado **no servidor** a partir dos preços do cardápio.
- Tabela própria `pedidos_web` (id, slug, cliente, telefone, endereco, pagamento, taxa_entrega_nome/valor, itens JSONB, subtotal, total, status, created_at) — evita corrida com snapshot de `app_state`.
- Cozinha: novo componente `PedidosWeb` (`src/modules/kitchen/PedidosWeb.tsx`) dentro do `OrderGrid` exibe pendentes com origem "Link Cardápio Digital" e botões **Iniciar preparo / Concluir**.
- APIs autenticadas: `GET /api/pedidos-web?status=` e `PATCH /api/pedidos-web/[id]` (status: `pendente | em_preparo | concluido`).

**4.5 Segurança**
- Middleware: `/api/cardapio-digital` adicionado a `PUBLIC_API_PREFIXES`; `/m/:path*` fora do matcher.
- Slug funciona como token de acesso (privacidade por obscuridade); API pública não expõe caixa/usuários.
- Teste smoke (dev, porta 3008) validou: slug válido/404, POST cria pedido com total server-side, preço manipulado rejeitado, listagem/atualização na Cozinha; banco restaurado depois.

---

### Fase 5 — Acertos finais e validação  ✅ concluída

- `npx tsc --noEmit` + `npm run lint` + `npm run build` verdes ao final de cada fase (1–4 e 5).
- Smoke tests executados: Fase 1 (usuários/auth/permissões) e Fase 4 (cardápio digital e pedidos web); banco restaurado após cada teste.
- Decisões das Fases 2–4 registradas nas seções correspondentes; decisões ainda em aberto listadas abaixo.

### Ajustes complementares (pós Fase 5)  ✅ concluídos

- **Confirmação de recebimento:** dialogs de confirmação antes de registrar o recebimento de **mesa** (`MenuCart.tsx` — total, forma de pagamento/fiado), **PDV** (`PDVScreen.tsx` — dialog de sucesso com total e botão "Confirmar recebimento") e **delivery** (`DeliveryCard.tsx` — total, forma de pagamento, cliente fiado). Nenhuma baixa é feita sem confirmação explícita.
- **Relatório de caixa detalhado:** nova aba **Caixa** (padrão ao abrir Relatórios) com cards (status, abertura, aberto por, valor inicial, entradas/saídas/previsão) e listas detalhadas de movimentações (transações com motivo + vendas com itens, quantidade, preço, método e cliente) do caixa aberto; quando fechado, mostra o último fechamento com seu `detail`.
- **Faturamento de pedidos web no fechamento:** ver item 3 da seção 7. Validado em smoke test: pedido web → concluído → fechar caixa (esperado = inicial + pedido web; venda/transação no `detail`; `faturado = TRUE`; segundo fechamento sem double-count). Banco restaurado ao seed de demo após o teste.
- **Recebimento parcial (múltiplas formas de pagamento):** venda de **mesa** (`CheckoutCurrentTable`), **PDV** (`FinalizarVendaPDV`) e **delivery** (`EndDelivery`) aceitam uma lista de parcelas — ex.: conta R$ 225 = 50 Pix + 100 Dinheiro + 50 Fiado (cliente com carteira) + 25 Cartão.
  - Novo componente `src/shared/components/PaymentSplitEditor.tsx` (editor de parcelas: método, valor, cliente fiado, lista, validação do restante, total/pago/restante) usado nos 3 dialogs de confirmação.
  - Novos helpers em `src/shared/lib/payments.ts`: `paymentMethodLabel`, `sumPagamentos`, `isPaymentSplitComplete`, `derivePaymentMethod` (método da maior parcela; fiado tem prioridade — retrocompatibilidade com o campo `metodo`), `LancarRecebimentoParcial` (lança **uma transação de entrada por parcela** + fiado na carteira via `LancarFiado`) e `formatNumber`.
  - Tipos: `VendaPagamentoType { metodo, valor, clienteId?, clienteNome? }` em `auxTypes.d.ts`; `VendaType.pagamentos?`; `DeliveryType.payments.parts?` em `globalTypes.d.ts`.
  - `RegistrarVenda` (`vendaActions.ts`) persiste `pagamentos` na venda para os relatórios.
  - Cada parcela gera uma movimentação própria de caixa, então o esperado no fechamento soma as parcelas (= total da conta).
- **Relatórios minuciosos (Caixa e Relatórios):** agregação por forma de pagamento usa `v.pagamentos` quando presente (senão `v.metodo`/`v.total` — sem double-count); listagem de vendas mostra itens (quantidade × produto — preço), nota de taxa, parcelas por método/cliente, totais por forma de pagamento, por origem, por cliente e por produto.
- **Correção defensiva do erro de Contabilidade** (`readAsDataURL`): `blobToDataURL` em `src/shared/lib/stateSerializer.ts` só chama `readAsDataURL` quando `blob instanceof Blob`; caso contrário retorna `''` (evita `TypeError` quando um snapshot antigo/persistido tem `imageBlob` como objeto serializado em vez de Blob).
- **Validação do recebimento parcial:** `npx tsc --noEmit`, `npm run lint` e `npm run build` verdes. Smoke test (server-side): venda R$ 225 em 4 parcelas → `expected = 100 (inicial) + 225 = 325`, `salesCount = 1`, `detail` preserva os 4 `pagamentos` e transações de entrada somam 225. Banco restaurado após o teste.
- **Correção de hidratação no Contabilidade/Financeiro:** o script inline que adiciona `dark` ao `<html>` antes da hidratação causava erro "hydrate(...) does not support className". Fix: `suppressHydrationWarning` no `<html>` em `src/app/layout.tsx`.
- **Fluxo de entregas "aguardando recebimento":** semântica em `deliveryUtils.ts` — `startedAt` sem `dispatchedAt` = **pendente** (pronto, aguardando atribuição de entregador); com `dispatchedAt` = **em andamento** (entregador saiu). Ao atribuir entregador, a entrega vai para "Em Andamento" e fica com banner "Aguardando recebimento do entregador..." até o retorno com o pagamento (`DeliveryCard.tsx`).
- **Cancelamento de entrega:** `CancelarDelivery(deliveryId)` em `DeliveryActions.ts` remove a entrega e o pedido correspondente da cozinha; recusa se já tiver `deliveredAt` (finalizada → cancelar pela venda no caixa). Botão "Cancelar" (com diálogo de confirmação) disponível nos status **pendente** e **em andamento**.
- **Cancelamento de venda já efetuada:** `CancelarVenda(vendaId)` em `vendaActions.ts` — exige caixa aberto, remove a venda e **estorna uma saída por parcela** (via `RecordTransaction`, usa `paymentMethodLabel`) e **reverte o fiado** na carteira do cliente (movimentação `credito` com valor negativo). Exposed nos Relatórios: botão "Cancelar" por venda com diálogo de confirmação e resumo do estorno (`RelatoriosScreen.tsx` — prop `onCancelarVenda` em `MovimentacaoLista`).
- **Cancelamento de pedido do Cardápio Digital:** status `'cancelado'` habilitado na constraint `pedidos_web_status_check` (migração atômica com `LOCK TABLE ... ACCESS EXCLUSIVE` para ser concorrência-safe) e no PATCH de `api/pedidos-web/[id]`. Botão "Cancelar pedido" em `PedidosWeb.tsx` quando `!faturado`; se já faturado, aviso para cancelar pela venda nos relatórios. Campo `faturado` exposto nas respostas da API.
- **Smoke test de cancelamento (server-side):** login → `/api/state` → constraint permite `'cancelado'` → pedido de teste PATCHed para `cancelado` → GET inclui `faturado` → pedido cancelado **não** entra no faturamento (`status='concluido' AND faturado=false`) → cleanup. 6/6 checks OK, banco preservado.

---

## 7. Riscos e decisões em aberto

1. **Origem real dos "Usuários"** — ✅ **Decidido (Fase 1 concluída):** a aba "Funcionarios" (client-side) foi **substituída** pela aba "Usuários" (server-backed) que controla login, papéis e senhas (`users`). `config.funcionarios` permanece apenas para a estatística do painel.
2. **Pedidos web** — ✅ **Decidido:** tabela dedicada `pedidos_web` (evita concorrência com o snapshot JSONB).
3. **Cardápio digital precisa de caixa aberto?** Pedidos entram pendentes mesmo com caixa fechado (cozinha prepara; financeiro só quando pago/fechado). ✅ **Decidido:** no fechamento do caixa (`/api/caixa/fechar`), pedidos web `concluido` e `faturado = FALSE` viram venda (`origem: "Cardápio Digital"`, `tipo` delivery se houver `endereco`) + transação de entrada, entram no `detail`/esperado e são marcados `faturado = TRUE` (sem double-count). Vendas ficam armazenadas no `app_state` para os relatórios.
4. **Múltiplos restaurantes**: o sistema hoje é single-tenant (1 restaurante, 1 `app_state`). O slug do cardápio digital pertence ao único restaurante.
5. **Login sem caixa**: logout com caixa aberto mantém caixa aberto no banco (comportamento definido). Validar se o próximo login deve continuar o mesmo caixa.
6. **Sangria/Suprimento**: já lançam transações no caixa aberto e entram no cálculo do esperado (Fase 2 concluída).

