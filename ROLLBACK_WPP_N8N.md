# Zelda PDV — Rollback WPP/n8n

## Escopo
Trabalhar somente em `D:\AIDir\restaurante-tech-main\restaurante-tech-main-zeldapdv`. Nunca editar, reconstruir, parar ou acessar volumes do projeto original. Não usar `down -v`, `docker volume prune` ou `docker system prune --volumes`.

## Snapshot
Antes de cada etapa, criar `.rollback\<timestamp>` e copiar `.env`, `docker-compose.deploy.yml`, `src` e `n8n\workflows`. Fazer dump somente do banco da cópia: `restaurante-zeldapdv-postgres`, banco `zeldapdv`, usuário `zelda`.

## Etapas
1. Inventariar contratos de produtos, pedidos, clientes e status.
2. Criar sessões WhatsApp, feedbacks e ChatWPP com migrações idempotentes.
3. Criar APIs para cliente, pedido pendente, consulta, feedback e transferência humana.
4. Implementar estados MENU, PEDIDO, ENTREGA, DADOS_CLIENTE, PAGAMENTO, CONSULTA, FEEDBACK, HUMANO e FINALIZADO.
5. Criar workflow WAHA+n8n+IA inativo e testar com número controlado.
6. Ativar somente após validar duplicidade, taxa, pagamento, cozinha, entrega e rollback.

## Rollback
Desativar o workflow no n8n; restaurar `src`, `.env`, Compose e workflows do snapshot; reconstruir somente `crm-zeldapdv`:

`docker-compose --env-file .env -f docker-compose.deploy.yml build crm-zeldapdv`
`docker-compose --env-file .env -f docker-compose.deploy.yml up -d --no-deps --force-recreate crm-zeldapdv`

Para banco: parar somente `crm-zeldapdv`, restaurar o dump no `restaurante-zeldapdv-postgres`/`zeldapdv` e iniciar o CRM. Nunca restaurar no projeto original.

## Aceite
Pedido pendente com número único; taxa vinda do CRM; cliente com nome, telefone, endereço, últimas compras e tag WhatsApp; feedback em Feedback pedidos WPP; chat humano em ChatWPP; automação bloqueada até Finalizar chat; segredos fora do código e dos JSON exportados.

Senha do n8n e chave da IA não são armazenadas neste documento. Como foram expostas na conversa, devem ser rotacionadas.

## Workflows de atendimento (4 variações)
Gerados por `scripts/gen-zeldapdv-ai-workflows.mjs` em `n8n/workflows/`:

- `zeldapdv-w1-waha-cloud.json` — WAHA + LLM Cloud (OpenAI `gpt-4o-mini`)
- `zeldapdv-w2-meta-cloud.json` — Meta Cloud API + LLM Cloud
- `zeldapdv-w3-waha-local.json` — WAHA + LLM Local (Ollama na VPN)
- `zeldapdv-w4-meta-local.json` — Meta Cloud API + LLM Local

Cada um usa o nó **AI Agent (LangChain)** + Chat Model + 4 Tools HTTP (get_menu_link, check_order_status, register_sac_feedback, transfer_to_human) e, no transporte WAHA, a tool extra `start_order` (encaminha o pedido ao CRM). O System Prompt unificado está embutido em cada workflow.

### Importação manual (n8n não auto-importa)
1. n8n UI → Workflows → Import from File → escolher um dos JSONs acima → Save.
2. Preencher credenciais: OpenAI API Key (cloud) ou Ollama Host (local); WAHA API Key/URL/Session e META_*/ZELDAPDV_* vêm do ambiente do container n8n.
3. Ativar (Active) somente o(s) workflow(s) desejado(s). Recomenda-se ativar W1 (WAHA+cloud) primeiro e validar ponta-a-ponta antes de ligar os demais.
4. O webhook do WAHA (`WHATSAPP_HOOK_URL`) já aponta para `zeldapdv-waha-cloud`; para usar LLM local, ajuste `WHATSAPP_HOOK_URL` para `zeldapdv-waha-local`. A Meta Cloud API é recebida pelo CRM (`/api/integrations/whatsapp/official/webhook`) que encaminha para `zeldapdv-meta-cloud` (ou `zeldapdv-meta-local` via `ZELDAPDV_META_AI_WEBHOOK_URL`).

### Variáveis de ambiente necessárias (`.env` / compose `n8n-zeldapdv`)
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (opcional), `OLLAMA_HOST=http://<IP_VPN>:11434`, `META_PHONE_ID`, `META_ACCESS_TOKEN`, `META_VERIFY_TOKEN`, `ZELDAPDV_META_AI_WEBHOOK_URL`, `WHATSAPP_HOOK_URL`. Garantir que `ZELDAPDV_WEBHOOK_SECRET` esteja definido (usado pelas Tools).
