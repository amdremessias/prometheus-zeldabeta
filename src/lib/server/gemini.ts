import { MenuPublico } from './cardapioDigital';

/* Agente IA de autoatendimento via Gemini.
 * Interpreta linguagem natural e devolve decisões estruturadas (intenção,
 * itens, tipo de entrega, pagamento) com fallback resiliente para a FSM. */

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
const MAX_ATTEMPTS = Number(process.env.GEMINI_MAX_ATTEMPTS || 2);

export const geminiEnabled = Boolean(API_KEY);

type ChatMessage = { role: 'user' | 'model'; text: string };

interface GeminiRawResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function callGemini(messages: ChatMessage[], schemaHint: boolean): Promise<string | null> {
    if (!API_KEY) return null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const generationConfig: Record<string, unknown> = {
                temperature: 0.4,
                maxOutputTokens: 1200,
            };
            if (schemaHint) generationConfig.responseMimeType = 'application/json';

            const body = {
                contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
                generationConfig,
            };
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                },
            );
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.error(`[gemini] HTTP ${res.status} (tentativa ${attempt}): ${errText.slice(0, 300)}`);
                if (attempt === MAX_ATTEMPTS) return null;
                await new Promise((r) => setTimeout(r, 500));
                continue;
            }
            const data = (await res.json()) as GeminiRawResponse;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) return text;
            if (attempt === MAX_ATTEMPTS) return null;
        } catch (err) {
            console.error(`[gemini] erro (tentativa ${attempt}): ${err instanceof Error ? err.message : String(err)}`);
            if (attempt === MAX_ATTEMPTS) return null;
            await new Promise((r) => setTimeout(r, 500));
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

function extractJson(text: string): Record<string, unknown> | null {
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            const parsed = JSON.parse(match[0]);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
}

function formatMoeda(v: number) {
    return 'R$ ' + v.toFixed(2).replace('.', ',');
}

export function formatMenuForPrompt(menu: MenuPublico): string {
    const linhas = menu.pratos.map((p) => `${p.id}. ${p.title} — ${formatMoeda(Number(p.price) || 0)}`).join('\n');
    const taxa = menu.taxasEntrega[0]
        ? `${menu.taxasEntrega[0].nome}: ${formatMoeda(Number(menu.taxasEntrega[0].valor) || 0)}`
        : '';
    return `Restaurante: ${menu.restaurantName}\n\nItens:\n${linhas}${taxa ? `\n\nEntrega: ${taxa}` : ''}`;
}

export interface GeminiDecision {
    intent: 'reply' | 'menu' | 'order' | 'status' | 'feedback' | 'human' | 'clarify';
    reply?: string;
    items?: { id: number; quantity: number }[];
    tipoEntrega?: 'entrega' | 'retirada';
    pagamento?: 'pix' | 'cartao' | 'dinheiro' | 'carteira';
    clienteNome?: string;
    endereco?: string;
    fullText?: string;
}

const SYSTEM_PROMPT = (menuText: string) => `Você é a IA de autoatendimento de um restaurante, atendendo clientes pelo WhatsApp.
Use APENAS os itens do cardápio abaixo (id, nome, preço). Nunca invente itens nem ids.

${menuText}

Responda SEMPRE em JSON (sem markdown) com este formato:
{
  "intent": "reply|menu|order|status|feedback|human|clarify",
  "reply": "sua resposta curta e acolhedora para o cliente",
  "items": [{"id": <id do cardápio>, "quantity": <qtde>}],
  "tipoEntrega": "entrega|retirada",
  "pagamento": "pix|cartao|dinheiro|carteira",
  "clienteNome": "nome se informado ou extraído",
  "endereco": "endereço se informado"
}

Regras:
- Se o cliente pedir itens em linguagem natural (ex.: "quero 2 hambúrgueres e 1 refrigerante"), extraia items com os ids CERTOS do cardápio e intent="order".
- Se pedir só o cardápio, intent="menu".
- Se perguntar sobre pedido/entrega/status, intent="status" (NÃO extraia itens).
- Se fizer elogio ou reclamação, intent="feedback".
- Se pedir para falar com atendente/humano, intent="human".
- Se a mensagem for saldação conversa solta sem pedido, intent="reply" (resposta curta amigável).
- Se quiser pedir mas os itens forem ambíguos, intent="clarify" (pergunte o que precisa).
- reply deve ser curto, no máximo 3 frases, e mencione valores em R$.`;

export async function interpretMessage(args: {
    text: string;
    menu: MenuPublico;
    history?: { sender: 'customer' | 'automation'; text: string }[];
}): Promise<GeminiDecision> {
    const menuText = formatMenuForPrompt(args.menu);
    const messages: ChatMessage[] = [{ role: 'user', text: SYSTEM_PROMPT(menuText) }];
    if (args.history && args.history.length) {
        const tail = args.history.slice(-6);
        messages.push({
            role: 'user',
            text: `Histórico recente da conversa:\n${tail.map((h) => `${h.sender === 'customer' ? 'Cliente' : 'IA'}: ${h.text}`).join('\n')}\n\nAgora responda considerando o histórico e a última mensagem.`,
        });
    }
    messages.push({ role: 'user', text: `Mensagem do cliente: "${args.text}"\n\nDevolva o JSON conforme o formato.` });

    const raw = await callGemini(messages, true);
    if (!raw) {
        return { intent: 'clarify', reply: 'Não consegui processar agora. Um atendente vai te ajudar em instantes. 🙏' };
    }
    const parsed = extractJson(raw);
    if (!parsed) {
        return { intent: 'clarify', reply: 'Não entendi direito. Pode repetir, por favor? 🙂' };
    }

    const intent = String(parsed.intent || 'reply').toLowerCase() as GeminiDecision['intent'];
    const reply = String(parsed.reply || '').trim();
    const items = Array.isArray(parsed.items)
        ? (parsed.items as { id?: number; quantity?: number }[]).map((i) => ({
              id: Number(i.id),
              quantity: Math.min(Math.max(Number(i.quantity) || 1, 1), 50),
          }))
        : undefined;
    const tipoEntrega = parsed.tipoEntrega === 'retirada' || parsed.tipoEntrega === 'entrega' ? parsed.tipoEntrega : undefined;
    const pagamentoMap: Record<string, GeminiDecision['pagamento']> = {
        pix: 'pix',
        cartao: 'cartao',
        dinheiro: 'dinheiro',
        carteira: 'carteira',
        fiado: 'carteira',
    };
    const pagamento = pagamentoMap[String(parsed.pagamento || '').toLowerCase()];

    return {
        intent,
        reply,
        items,
        tipoEntrega,
        pagamento,
        clienteNome: String(parsed.clienteNome || '').trim() || undefined,
        endereco: String(parsed.endereco || '').trim() || undefined,
        fullText: raw,
    };
}