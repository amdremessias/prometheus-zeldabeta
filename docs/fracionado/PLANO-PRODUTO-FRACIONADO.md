# Plano — Produto Fracionado (1/2, 1/3, 1/4)

**Versão:** 1.0 — 2026-09-14
**Base:** `V.1.11.14-import-31082026`
**Stack:** Next.js 16 App Router / React 19 / TS / zustand / IndexedDB + API PostgreSQL

## 1. Objetivo

Permitir que produtos marcados como "pode ser vendido fracionado" (ex.: pizzas) sejam
vendidos combinando **n sabores de fração igual** (1/2, 1/3 ou 1/4), com:

- Seletor de fração **dentro do modal de opções/obs existente** (`ProdutoOpcoesModal`).
- **Obrigatoriedade** de preencher todos os sabores antes de adicionar ao pedido.
- **Preço = fração de maior valor** (ex.: 1/2 Calabresa R$22 + 1/2 Frango R$24 → cobra R$24).
- Configuração por produto já existente em Configurações → Cardápio (checkbox "Permitir Fracionamento")
  + frações permitidas, agora incluindo **1/3**.

## 2. Estado atual (descoberto na base) — implementação parcial, com problemas

Já existem artefatos de uma tentativa anterior:

| Artefato | Estado |
|---|---|
| `src/modules/menu/menuFoodActions.ts` — `isProductFractionable`, `getFractionableProducts`, `calcularPrecoFracionado` (max), `montarNomeFracionado`, `handleFraction` | Existe, mas `handleFraction` tem bug (abaixo) |
| `src/shared/components/FracaoModal.tsx` — modal separado de fração (2 e 4 sabores) | Existe; **será removido** (o usuário pediu a seleção no modal de obs existente) |
| `CardapioFoodType.permitirFracionamento` / `fracoesPermitidas` / `tipoFracao` | No tipo (existentes) |
| `FoodCartType.isFracionado` / `fracoes` | No tipo (existentes) |
| IndexedDB `src/lib/db.ts` `Prato` — `permitirFracionamento`, `fracoesPermitidas` | Persistidos (sem migração) |
| `SettingsMenu.tsx` — checkbox fracionamento + checkboxes 1/2 e 1/4 | Existe; **falta 1/3** |
| Wiring parcial: `MenuGrid`, `PDVScreen`, `CreateDeliveryOrder` | Aberto via `FracaoModal` quando `permitirFracionamento` |
| `CardapioScreen` (admin) e `CardapioPublico` (digital) | **Não** tratam fracionado |

### Problemas a corrigir (bugs reais da implementação parcial)

1. **Dois `FracaoItem` conflitantes**:
   - `globalTypes.d.ts`: `{ produtoId, montante, sabor? }` — usado na **renderização** (MenuCart:298, PDVScreen:392/593, CreateDeliveryOrder:301) → exibe `f.montante` como `undefined`.
   - `auxTypes.d.ts`: `{ produtoId, nome, precoOriginal, fracao }` — usado na **produção** (FracaoModal, handleFraction).
   - Resultado em runtime: a linha "N porção(ões)" mostra **"undefined"**.
2. **Bug de merge no carrinho**: em `handleFraction`, o `title` do item é sobrescrito por uma chave interna
   (`frac:12:1/2,5:1/2`) para permitir somar quantidades. O usuário veria essa chave no lugar do nome
   ("1/2 Calabresa + 1/2 Frango").
3. **1/3 fora do cadastro**: só há checkbox para 2 e 4.
4. **PDV Enter (venda rápida)**: o atalho Enter chama `addLine` diretamente sem abrir opções, **bypassando**
   a seleção de fração para produtos fracionáveis (PDVScreen:217-218).
5. **Cobertura incompleta**: Cardápio (admin) e cardápio digital não oferecem fracionado.

## 3. Decisões de design

- **D1 — Seleção de fração dentro do `ProdutoOpcoesModal`** (o modal de obs existente), conforme pedido do
  usuário. O `FracaoModal` separado é removido. Todos os 5 consumidores ganham a seção automaticamente.
- **D2 — Formato canônico único de `FracaoItem`**: `{ produtoId: number; nome: string; precoOriginal: number; fracao: string }`
  (fracao = "1/2" | "1/3" | "1/4"). Remove-se a cópia do `auxTypes` e a forma `montante/sabor`.
  Linhas de renderização passam a usar `f.fracao + ' ' + f.nome`.
- **D3 — Merge do carrinho**: o item mantém `title` = nome legível ("1/2 Calabresa + 1/2 Frango"). A dedução
  para somar quantidade passa a usar uma **chave interna própria** (`fracaoKey`, ex. `frac:12:1/2,5:1/2`),
  nunca sobrescrevendo o `title`.
- **D4 — 1/3 habilitado**: checkbox `3` em `SettingsMenu` ao lado de `2` e `4`. Tipos suportados: `[2, 3, 4]`
  (rótulos genéricos `1/${tipoFracao}` já cobrem 3).
- **D5 — Preço**: aplicar `calcularPrecoFracionado` = **máximo** dos `precoOriginal` das frações, e exibir a
  regra no modal ("Valor = sabor de maior valor").
- **D6 — Persistência e fiscal sem mudanças**: `FoodCartType`/`VendaItemType` já carregam `isFracionado`/`fracoes`;
  o título combinado segue como descrição (NFC-e/caixa). Melhorias (detalhar frações no cupom/relatório) ficam fora de escopo.

## 4. Escopo

### Fora de escopo
- Frações mistas (ex.: 1/3 de um + 2/3 de outro) — apenas frações iguais (n sabores de 1/n).
- Detalhamento das frações no cupom fiscal e no relatório de fechamento de caixa.
- Preço proporcional diferente da regra "maior valor".

## 5. Fases de implementação

### Fase 1 — Consolidação de tipos e correção de bugs (base)
1. `src/types/globalTypes.d.ts`: `FracaoItem` passa a ser `{ produtoId; nome; precoOriginal; fracao }`.
2. `src/types/auxTypes.d.ts`: remover a cópia de `FracaoItem`.
3. `menuFoodActions.ts`: `handleFraction` — não sobrescrever `title`; usar `fracaoKey` para merge.
4. Atualizar renderização das porções em: `MenuCart.tsx:296-301`, `PDVScreen.tsx:390-394` e `:591-595`,
   `CreateDeliveryOrder.tsx:301`.
5. Gate: `npx tsc --noEmit` exit 0.

### Fase 2 — Seção "Fracionamento" no `ProdutoOpcoesModal`
1. `ProdutoOpcoesResult` ganha campo opcional `fracoes?: FracaoItem[]` (+ `isFracionado?: boolean`).
2. Se `food.permitirFracionamento`, renderizar seção antes de "Adicionar":
   - Select de tipo com `food.fracoesPermitidas` (padrão `[2]`; opções `2/3/4` → rótulos "1/2", "1/3", "1/4").
   - Slots (1 por sabor); cada slot escolhe produto fracionável da **mesma categoria** (`getFractionableProducts`)
     — com fallback de fração exibido se a lista estiver vazia.
   - Botão "Adicionar" fica **desabilitado** até preencher todos os `tipo` sabores (label "Preencha os N sabores").
   - Prévia do preço em tempo real = `calcularPrecoFracionado` + regra "maior valor".
   - Mantém quantidade, observação e adicionais do modal original.
3. Ajustes menores de layout (modal pode ficar com scroll — `DialogContent` com `max-h-[90vh]`).

### Fase 3 — Wiring dos consumidores (remover `FracaoModal`)
1. Remover `src/shared/components/FracaoModal.tsx` e imports em `MenuGrid`, `PDVScreen`, `CreateDeliveryOrder`.
2. **MenuGrid** (`handleAddToOptions`): abrir sempre `ProdutoOpcoesModal`; no `onConfirm`, se `r.fracoes`
   presente → `handleFraction(r.fracoes, mesaAtual?.id, r.quantity, r.notes)`, senão `handleIncrease`.
3. **PDVScreen**: `addLine` aceita `fracoes` → título `montarNomeFracionado`, preço `calcularPrecoFracionado`,
   `isFracionado:true`; corrigir o atalho **Enter** (se `first.permitirFracionamento`, abrir opções).
4. **CreateDeliveryOrder**: `addLineToCart` aceita `fracoes`; remover `handleFractionConfirm`/`fracaoFood`.
5. **CardapioScreen**: `confirmarOpcoes` usa `handleFraction` quando `r.fracoes` presente.
6. **CardapioPublico**: verificar fluxo do item no carrinho digital (já renderiza `ProdutoOpcoesModal`); a seção
   entra automaticamente; validar merge de item fracionado no `deliverySelecionado`.
7. Gate: `npx tsc --noEmit` + `npm run build` exit 0.

### Fase 4 — Cadastro: incluir 1/3
1. `SettingsMenu.tsx`: adicionar checkbox "1/3 (Terços)" com valor `3` ao lado de 1/2 e 1/4.
2. Persistência já coberta pelo `Prato` no IndexedDB (sem migração) — confirmar save/reload.

### Fase 5 — Validação e release
1. Testes manuais/E2E nos fluxos: mesa (MenuGrid), PDV (inclusive Enter), delivery/retirada,
   cardápio digital e cardápio admin — cobrindo 1/2, 1/3 e 1/4, obrigatoriedade dos sabores e preço pelo
   maior valor (caso: 22 + 24 → cobra 24).
2. Verificar item no carrinho, envio à cozinha, fechamento de caixa e cupom (título combinado).
3. `npx tsc --noEmit` + `npm run build` exit 0; rebuild do stack Docker; HTTP 200 em `http://localhost:3013/login`.
4. Bump de versão (`src/shared/lib/version.ts`, `scripts/make-stable-release.sh`, `STABLE-VERSION.md`) e geração
   do tarball fix-stable `zeldapdv-stable-<versão>-<data>.tar.gz`; aplicar na VPS via `./scripts/vps-update.sh`.

## 6. Riscos e mitigações
- **Ambiguidade de tipos (`FracaoItem`)**: resolvida na Fase 1 (decisão D2).
- **Bug de título no carrinho**: corrigido na Fase 1 via `fracaoKey` (D3).
- **Cardápio digital**: precisa garantir que a lista de fracionáveis da categoria venha do catálogo público
  (mesmo conjunto de pratos). Verificar na Fase 3.6.
- **Modal mais longo com scroll**: layout ajustado na Fase 2.

## 7. Critérios de aceite
- Produto marcado como fracionável abre o modal de obs com a seção de fração (1/2, 1/3, 1/4 conforme o cadastro).
- É impossível adicionar sem preencher todos os sabores.
- Preço cobrado = maior preço entre as frações.
- Item aparece com título "1/2 X + 1/2 Y" (e não a chave interna) e com o detalhe das porções corrigido.
- Funciona nos 5 fluxos (mesa, PDV, delivery/retirada, cardápio digital, cardápio admin).
- tsc + build exit 0; app no ar; fix-stable atualizado.