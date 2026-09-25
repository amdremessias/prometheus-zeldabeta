import { MenuPublico } from './cardapioDigital';
import { interpretMessage, GeminiDecision } from './gemini';

/* Cliente do Agente IA hospedado no n8n (padrão teknos: a IA vive no n8n e o
 * CRM a aciona como um serviço). Se o n8n estiver indisponível, cai graciosamente
 * para o Gemini local (gemini.ts), garantindo resiliência do atendimento. */

const AI_WEBHOOK_URL = String(process.env.ZELDAPDV_AI_WEBHOOK_URL ?? '').trim();
const AI_SECRET = String(process.env.ZELDAPDV_WEBHOOK_SECRET ?? process.env.CRM_WEBHOOK_SECRET ?? '');
const AI_TIMEOUT_MS = Number(process.env.ZELDAPDV_AI_TIMEOUT_MS || 20000);

export async function getAiDecision(args: {
  text: string;
  menu: MenuPublico;
  history: { sender: 'customer' | 'automation'; text: string }[];
}): Promise<GeminiDecision | null> {
  if (!AI_WEBHOOK_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(AI_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-zeldapdv-secret': AI_SECRET },
      body: JSON.stringify({
        text: args.text,
        menu: args.menu,
        history: args.history,
        secret: AI_SECRET,
        geminiKey: String(process.env.GEMINI_API_KEY ?? ''),
        geminiModel: String(process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as GeminiDecision | null;
    if (!data || typeof data !== 'object' || !data.intent) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Tenta o agente no n8n; se indisponível/inválido, usa o Gemini local (fallback). */
export async function interpretWithFallback(args: {
  text: string;
  menu: MenuPublico;
  history: { sender: 'customer' | 'automation'; text: string }[];
}): Promise<GeminiDecision | null> {
  const remote = await getAiDecision(args).catch(() => null);
  if (remote && remote.intent) return remote;
  return interpretMessage(args);
}
