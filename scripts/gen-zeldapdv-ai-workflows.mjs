// Gera os 4 workflows n8n de atendimento ZeldaPDV (WAHA/Meta x Cloud/Local).
// Usa o nó nativo AI Agent (LangChain) + Chat Model + Tool HTTP Request.
// Execução: node scripts/gen-zeldapdv-ai-workflows.mjs
// Saída: n8n/workflows/zeldapdv-wN-<transport>-<cloud|local>.json
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'n8n', 'workflows');
mkdirSync(OUT_DIR, { recursive: true });

const SYSTEM_PROMPT =
  'Você é o assistente virtual do restaurante integrado ao sistema ZeldaPDV Food. Seu objetivo é atender os clientes com cortesia, rapidez e clareza. ' +
  'Você pode enviar o link do cardápio digital, verificar o status de pedidos em andamento e registrar feedbacks (elogios, sugestões ou reclamações). ' +
  'Se o cliente manifestar insatisfação grave, problemas com o pedido ou pedir expressamente para "falar com atendente/humano", acione imediatamente a ferramenta transfer_to_human. ' +
  'Mantenha respostas curtas e formatadas para leitura fácil no WhatsApp. Não invente preços ou itens; use get_menu_link para obter o cardápio real. ' +
  'Se o cliente quiser fazer um pedido, use start_order (quando disponível) para iniciar o atendimento de pedido no CRM.';

const SECRET_HEADER = [{ name: 'x-zeldapdv-secret', value: '={{ $env.ZELDAPDV_WEBHOOK_SECRET }}' }];

// ----- Code node sources (sem ${} nem backticks para não conflitar no gerador) -----
const CODE_EXTRAIR =
  "const root = $json || {};\n" +
  "const b = (root.body && typeof root.body === 'object') ? root.body : root;\n" +
  "const payload = (b.payload && typeof b.payload === 'object') ? Object.assign({}, b, b.payload) : b;\n" +
  "const rawChatId = String(payload.chatId || payload.chat_id || payload.from || payload.to || b.chatId || '');\n" +
  "const phone = String(payload.phone || payload.from || rawChatId || '').replace(/@(c\\.us|lid)$/i, '').trim();\n" +
  "const text = String(payload.text || payload.body || payload.message || '').trim();\n" +
  "const name = String(payload.pushName || payload.customer_name || payload.customerName || payload.notifyName || '');\n" +
  "const channel = String(payload.channel || (rawChatId.endsWith('@lid') ? 'cloud_api' : 'waha'));\n" +
  "return [{ json: { phone: phone, text: text, name: name, chatId: rawChatId, channel: channel } }];";

const CODE_MERGE_ESTADO =
  "const http = ($json.body && typeof $json.body === 'object') ? $json.body : $json;\n" +
  "return [{ json: Object.assign({}, $('Extrair Dados').first().json, { estado: http }) }];";

const CODE_MERGE_CHECKIN =
  "const http = ($json.body && typeof $json.body === 'object') ? $json.body : $json;\n" +
  "const up = $('Merge Estado').first().json;\n" +
  "const isNew = !!(http.is_new_session || http.status === 'NOVO' || (up.estado && up.estado.status === 'NOVO'));\n" +
  "return [{ json: Object.assign({}, up, { checkin: http, isNew: isNew }) }];";

function codeNode(id, name, js, pos) {
  return { id: id, name: name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, parameters: { jsCode: js } };
}
function httpNode(id, name, method, url, pos, opts) {
  opts = opts || {};
  const node = { id: id, name: name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, parameters: { method: method, url: url, options: {} } };
  if (opts.headers) { node.parameters.sendHeaders = true; node.parameters.headerParameters = { parameters: opts.headers }; }
  if (opts.query) { node.parameters.sendQuery = true; node.parameters.queryParameters = { parameters: opts.query }; }
  if (opts.bodyParams) { node.parameters.sendBody = true; node.parameters.bodyType = 'json'; node.parameters.bodyParameters = { parameters: opts.bodyParams }; }
  else if (opts.bodyExpr) { node.parameters.sendBody = true; node.parameters.bodyType = 'json'; node.parameters.body = opts.bodyExpr; }
  return node;
}
function toolNode(id, name, toolName, description, method, url, pos, opts) {
  opts = opts || {};
  const p = {
    name: toolName,
    description: description,
    method: method,
    url: url,
    sendHeaders: true,
    headerParameters: { parameters: SECRET_HEADER },
    options: {},
  };
  if (opts.bodyParams) { p.sendBody = true; p.bodyType = 'json'; p.bodyParameters = { parameters: opts.bodyParams }; }
  else if (opts.bodyExpr) { p.sendBody = true; p.bodyType = 'json'; p.body = opts.bodyExpr; }
  return { id: id, name: name, type: '@n8n/n8n-nodes-langchain.toolHttpRequest', typeVersion: 1, position: pos, parameters: p };
}

function makeWorkflow({ num, name, path, isLocal, transport }) {
  const llmNode = isLocal
    ? { id: 'llm', name: 'LLM Local (Ollama)', type: '@n8n/n8n-nodes-langchain.lmChatOllama', typeVersion: 1, position: [2260, 300], parameters: { model: '={{ $env.OLLAMA_MODEL || "llama3.1:8b" }}', ollamaHost: '={{ $env.OLLAMA_HOST }}', options: {} } }
    : { id: 'llm', name: 'LLM Cloud (OpenAI)', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', typeVersion: 1, position: [2260, 300], parameters: { model: '={{ $env.OPENAI_MODEL || "gpt-4o-mini" }}', apiKey: '={{ $env.OPENAI_API_KEY }}', options: {} } };

  const fromPhone = '={{ $(\'Extrair Dados\').first().json.phone }}';
  const fromName = '={{ $(\'Extrair Dados\').first().json.name }}';
  const fromText = '={{ $(\'Extrair Dados\').first().json.text }}';

  const toolMenu = toolNode('tm', 'Tool: get_menu_link', 'get_menu_link', 'Retorna a URL do cardápio digital quando o cliente pede para ver produtos, preços ou fazer pedidos.', 'GET', 'http://crm-zeldapdv:3000/api/v1/menu-link', [3040, 240]);
  const toolStatus = toolNode('to', 'Tool: check_order_status', 'check_order_status', 'Consulta o status do pedido mais recente do cliente pelo telefone.', 'GET', '=http://crm-zeldapdv:3000/api/v1/orders/status?phone=' + fromPhone, [3040, 380]);
  const toolSac = toolNode('ts', 'Tool: register_sac_feedback', 'register_sac_feedback', 'Registra elogio, reclamação ou sugestão no módulo administrativo do ZeldaPDV.', 'POST', 'http://crm-zeldapdv:3000/api/v1/sac/tickets', [3040, 520], {
    bodyParams: [
      { name: 'phone', value: fromPhone },
      { name: 'kind', value: '={{ $fromAI(\'kind\', \'elogio\', \'string\') }}' },
      { name: 'message', value: '={{ $fromAI(\'message\', \'\', \'string\') }}' },
    ],
  });
  const toolHuman = toolNode('th', 'Tool: transfer_to_human', 'transfer_to_human', 'Pausa a IA e direciona a conversa para um atendente humano (transbordo). Dispara no CRM a mudança de status para atendimento humano.', 'POST', 'http://crm-zeldapdv:3000/api/v1/handoff', [3040, 660], {
    bodyParams: [
      { name: 'phone', value: fromPhone },
      { name: 'customer_name', value: fromName },
      { name: 'message', value: '={{ $fromAI(\'message\', \'\', \'string\') }}' },
    ],
  });

  const toolNodes = [toolMenu, toolStatus, toolSac, toolHuman];
  const toolConnections = [toolMenu, toolStatus, toolSac, toolHuman].map((t) => ({ node: t.name, type: 'main', index: 0 }));

  let toolOrder = null;
  if (transport === 'waha') {
    toolOrder = toolNode('to2', 'Tool: start_order', 'start_order', 'Inicia um pedido pelo WhatsApp encaminhando a mensagem para o CRM processar o carrinho. Use quando o cliente quiser comprar ou montar um pedido.', 'POST', 'http://crm-zeldapdv:3000/api/whatsapp/inbound', [3040, 800], {
      bodyExpr: '={{ JSON.stringify({ channel: "waha", payload: { from: $(\'Extrair Dados\').first().json.phone, body: $(\'Extrair Dados\').first().json.text, pushName: $(\'Extrair Dados\').first().json.name } }) }}',
    });
    toolNodes.push(toolOrder);
  }

  const sendNode = transport === 'waha'
    ? httpNode('wa', 'Enviar WAHA', 'POST', '={{ $env.WAHA_API_URL }}/api/sendText', [4080, 480], {
        headers: [{ name: 'Content-Type', value: 'application/json' }, { name: 'X-Api-Key', value: '={{ $env.WAHA_API_KEY }}' }],
        bodyExpr: '={{ JSON.stringify({ session: $env.WAHA_SESSION, chatId: $json.chatId || ($json.phone + "@c.us"), text: $json.output }) }}',
      })
    : httpNode('mt', 'Enviar Meta', 'POST', '=https://graph.facebook.com/v20.0/{{ $env.META_PHONE_ID }}/messages', [4080, 480], {
        headers: [{ name: 'Authorization', value: '=Bearer {{ $env.META_ACCESS_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }],
        bodyExpr: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.phone, type: "text", text: { body: $json.output } }) }}',
      });

  const agentText = '=Cliente: {{ $json.name }} ({{ $json.phone }})' + "\n" + 'Mensagem: {{ $json.text }}{{ $json.isNew ? "\n[NOVA CONVERSA] Apresente-se brevemente e envie o link do cardápio digital." : "" }}';

  const agent = {
    id: 'agent', name: 'AI Agent', type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 1, position: [2000, 480],
    parameters: {
      agent: { mode: 'openAiTools', configuration: { hasOutputParser: false } },
      prompt: SYSTEM_PROMPT,
      text: agentText,
      options: {},
    },
  };

  const memory = { id: 'mem', name: 'Memória', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', typeVersion: 1, position: [2000, 700], parameters: { sessionKey: '={{ $json.phone }}', contextWindowLength: 5 } };

  const nodes = [
    { id: 'w', name: 'Webhook Atendimento', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [250, 400], webhookId: path, parameters: { path: path, httpMethod: 'POST', responseMode: 'lastNode', options: {} } },
    codeNode('n1', 'Extrair Dados', CODE_EXTRAIR, [500, 400]),
    httpNode('n2', 'Consultar Estado', 'GET', 'http://crm-zeldapdv:3000/api/v1/crm/chat-status', [760, 400], { headers: SECRET_HEADER, query: [{ name: 'phone', value: '={{ $json.phone }}' }] }),
    codeNode('n2b', 'Merge Estado', CODE_MERGE_ESTADO, [1000, 400]),
    {
      id: 'sw1', name: 'Roteamento', type: 'n8n-nodes-base.switch', typeVersion: 3, position: [1240, 400],
      parameters: {
        mode: 'rules',
        rules: {
          values: [
            { outputKey: 'EM_HUMANO', conditions: { combinator: 'or', conditions: [{ leftValue: '={{ $json.estado.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'EM_HUMANO' }], options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' } } },
            { outputKey: 'EM_IA', conditions: { combinator: 'or', conditions: [{ leftValue: '={{ $json.estado.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'EM_IA' }], options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' } } },
            { outputKey: 'FINALIZADO', conditions: { combinator: 'or', conditions: [{ leftValue: '={{ $json.estado.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'FINALIZADO' }], options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' } } },
            { outputKey: 'NOVO', conditions: { combinator: 'or', conditions: [{ leftValue: '={{ $json.estado.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'NOVO' }], options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' } } },
          ],
        },
      },
    },
    { id: 'parar', name: 'Parar (Humano)', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [1500, 200] },
    httpNode('ck', 'Check-in (reset EM_IA)', 'POST', 'http://crm-zeldapdv:3000/api/v1/crm/conversations/check-in', [1500, 480], { headers: SECRET_HEADER, bodyParams: [{ name: 'phone', value: '={{ $json.phone }}' }, { name: 'customer_name', value: '={{ $json.name }}' }] }),
    codeNode('ckb', 'Merge Checkin', CODE_MERGE_CHECKIN, [1740, 480]),
    agent,
    llmNode,
    memory,
    ...toolNodes,
    sendNode,
  ];

  const agentToolConns = toolNodes.map((t) => ({ node: t.name, type: 'ai_tool', index: 0 }));

  const conns = {
    'Webhook Atendimento': { main: [[{ node: 'Extrair Dados', type: 'main', index: 0 }]] },
    'Extrair Dados': { main: [[{ node: 'Consultar Estado', type: 'main', index: 0 }]] },
    'Consultar Estado': { main: [[{ node: 'Merge Estado', type: 'main', index: 0 }]] },
    'Merge Estado': { main: [[{ node: 'Roteamento', type: 'main', index: 0 }]] },
    'Roteamento': { main: [
      [{ node: 'Parar (Humano)', type: 'main', index: 0 }],
      [{ node: 'Check-in (reset EM_IA)', type: 'main', index: 0 }],
      [{ node: 'Check-in (reset EM_IA)', type: 'main', index: 0 }],
      [{ node: 'Check-in (reset EM_IA)', type: 'main', index: 0 }],
    ] },
    'Check-in (reset EM_IA)': { main: [[{ node: 'Merge Checkin', type: 'main', index: 0 }]] },
    'Merge Checkin': { main: [[{ node: 'AI Agent', type: 'main', index: 0 }]] },
    'AI Agent': {
      main: [[{ node: sendNode.name, type: 'main', index: 0 }]],
      ai_languageModel: [[{ node: llmNode.name, type: 'ai_languageModel', index: 0 }]],
      ai_memory: [[{ node: 'Memória', type: 'ai_memory', index: 0 }]],
      ai_tool: [agentToolConns],
    },
  };

  return {
    id: String(num), name: name, active: false,
    settings: { executionOrder: 'v1', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', saveExecutionProgress: true },
    nodes: nodes,
    connections: conns,
  };
}

const configs = [
  { num: 10, name: 'ZeldaPDV - W1 WAHA + Cloud LLM', path: 'zeldapdv-waha-cloud', isLocal: false, transport: 'waha' },
  { num: 11, name: 'ZeldaPDV - W2 Meta + Cloud LLM', path: 'zeldapdv-meta-cloud', isLocal: false, transport: 'meta' },
  { num: 12, name: 'ZeldaPDV - W3 WAHA + Local LLM', path: 'zeldapdv-waha-local', isLocal: true, transport: 'waha' },
  { num: 13, name: 'ZeldaPDV - W4 Meta + Local LLM', path: 'zeldapdv-meta-local', isLocal: true, transport: 'meta' },
];

for (const cfg of configs) {
  const wf = makeWorkflow(cfg);
  const idx = configs.indexOf(cfg) + 1;
  const file = resolve(OUT_DIR, 'zeldapdv-w' + idx + '-' + cfg.transport + '-' + (cfg.isLocal ? 'local' : 'cloud') + '.json');
  writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log('Gerado (id ' + cfg.num + '):', file);
}
console.log('Pronto. Importe os 4 JSONs no n8n e ative os desejados.');
