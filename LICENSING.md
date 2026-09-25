# Licenciamento (Módulo JWT Ed25519) — modo "dormante"

> **Estado atual:** o módulo está **implementado e validado em staging isolado**, porém
> **DESLIGADO (dormante)** em produção. Enquanto `LICENSE_MASTER_PUBLIC_KEY` estiver
> vazio, o sistema funciona exatamente como antes — **não bloqueia, não pede licença,
> não incomoda nenhum cliente**. Todas as estruturas existem para serem habilitadas no
> futuro sem risco.

## O que o módulo faz (quando ligado)
Trava o acesso da instância com base em um token JWT assinado (Ed25519 / EdDSA):
- `status = valid` → acesso liberado.
- vencido dentro de `grace_days` → aviso, ainda abre.
- vencido além da carência / `domain` ou `client_id` não batem / revogado → bloqueia:
  - páginas `/app` redirecionam para `/license` (tela "Acesso Bloqueado").
  - APIs retornam `403` (exceto `/api/license/*`, que são públicas para a tela funcionar).

## Como funciona (visão geral)
- **Master (você):** guarda `LICENSE_MASTER_PRIVATE_KEY` (secreto) + `MASTER_API_TOKEN`.
  Emite/revoga licenças via API.
- **Instância cliente:** recebe `LICENSE_MASTER_PUBLIC_KEY` (só confere) + `LICENSE_JWT`
  (a licença) + `LICENSE_CLIENT_ID` + `LICENSE_DOMAIN`.
- A verificação roda num *middleware* (edge) que lê `LICENSE_JWT` e confere assinatura +
  validade + `domain` + `client_id` + revogação (via tabela `license_revocations`).

## Arquivos (já presentes)
- `src/lib/license-verify.ts` — verificação pura, sem banco (bundle do middleware).
- `src/lib/server/licensing.ts` — camada de banco (tabelas, `signLicense`, `activateLicense`, revogação).
- `src/middleware.ts` — gate de licença (antes da autenticação).
- `src/app/license/page.tsx` — tela de bloqueio + botão "Acesso Emergencial (24h)".
- `src/app/api/license/{status,generate,emergency,revoke}/route.ts` — API do Master.
- `scripts/gen-licensing-keys.mjs` — gera par Ed25519 + licença de exemplo.
- `ROLLBACK_LICENSING.md` — plano de rollback (imagem fixada + dump).

## API do Master (superusuário)
Todas exigem header `x-master-token: $MASTER_API_TOKEN`. Sem ele → `401`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/license/status` | (público) estado atual da licença. |
| POST | `/api/license/generate` | assina nova licença (`{client_id, type, domain, grace_days}`). |
| POST | `/api/license/revoke` | revoga um `lic_id` (`{lic_id}`). |
| POST | `/api/license/emergency` | emite `TEMP_24H` uso único (2ª chamada → `409`). |

## Para HABILITAR no futuro (passo a passo)
1. Gerar o par de chaves:
   ```bash
   node scripts/gen-licensing-keys.mjs
   ```
   Copie a **chave pública** (vai para o cliente) e a **chave privada** (guarde no Master).
2. No `.env` da **instância cliente**, defina:
   ```
   LICENSE_MASTER_PUBLIC_KEY=<chave pública>
   LICENSE_CLIENT_ID=<id do cliente>
   LICENSE_DOMAIN=<domínio>
   LICENSE_JWT=<token emitido via /api/license/generate>
   ```
3. Na estação **Master**, guarde `LICENSE_MASTER_PRIVATE_KEY` e defina `MASTER_API_TOKEN`.
4. Redeploy (`docker compose up -d --build crm-zeldapdv`) e confira:
   ```bash
   curl -fsS http://localhost:3013/api/license/status
   # -> {"licensing_enabled":true,"status":"valid",...}
   ```

## Teste isolado (sem tocar produção)
```bash
node scripts/gen-staging-license.mjs
docker compose -f docker-compose-staging.yml --env-file staging.env --env-file staging-licensing.env up -d
# exercite /api/license/{status,generate,revoke,emergency} em http://localhost:3014
docker compose -f docker-compose-staging.yml down -v   # limpa
```

## Rollback
Imagem fixada: `crm-zeldapdv:rollback-baseline-29082026`. Ver `ROLLBACK_LICENSING.md`.
Como o módulo é opt-in (só ativa com a chave pública), o rollback mais simples é apenas
**remover `LICENSE_MASTER_PUBLIC_KEY` do `.env` e redeploy** — volta ao comportamento
original sem nenhum bloqueio.
