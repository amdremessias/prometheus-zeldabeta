import { MenuPublico } from './cardapioDigital';
import { buildSystemPrompt, formatMenuForPrompt, parseGeminiDecision, GeminiDecision } from './gemini';

function endpointFor(baseUrl: string) {
  const url = new URL(String(baseUrl || '').trim());
  const path = url.pathname.replace(/\/+$/, '');
  if (!path.endsWith('/chat/completions')) url.pathname = path.endsWith('/v1') ? path + '/chat/completions' : path + '/v1/chat/completions';
  return url.toString();
}

export async function interpretOpenAiCompatible(args: {
  text: string;
  menu: MenuPublico;
  history: { sender: 'customer' | 'automation'; text: string }[];
}): Promise<GeminiDecision | null> {
  const baseUrl = String(process.env.ZELDAPDV_AI_GATEWAY_URL || '').trim();
  if (!baseUrl) return null;
  const model = process.env.ZELDAPDV_AI_GATEWAY_MODEL || 'default';
  const apiKey = process.env.ZELDAPDV_AI_GATEWAY_API_KEY || '';
  const timeoutMs = Math.max(1000, Number(process.env.ZELDAPDV_AI_GATEWAY_TIMEOUT_MS || 30000));
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: buildSystemPrompt(formatMenuForPrompt(args.menu)) },
  ];
  for (const item of (args.history || []).slice(-8)) {
    const content = String(item.text || '').trim();
    if (content) messages.push({ role: item.sender === 'customer' ? 'user' : 'assistant', content });
  }
  messages.push({ role: 'user', content: 'Mensagem atual do cliente: ' + args.text + '\n\nRetorne somente JSON conforme o formato do sistema.' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
    const response = await fetch(endpointFor(baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1200 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[ai-gateway] HTTP ' + response.status);
      return null;
    }
    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    const raw = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part: any) => part?.text || '').join('') : '';
    return raw ? parseGeminiDecision(raw) : null;
  } catch (error) {
    console.error('[ai-gateway] falha de conexão: ' + (error instanceof Error ? error.message : 'erro desconhecido'));
    return null;
  } finally {
    clearTimeout(timer);
  }
}
