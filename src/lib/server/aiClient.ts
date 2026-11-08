import { MenuPublico } from './cardapioDigital';
import { pool } from './db';
import { interpretMessage, GeminiDecision, geminiEnabled, parseGeminiDecision } from './gemini';
import { interpretOpenAiCompatible } from './openAiCompatible';

const AI_WEBHOOK_URL = String(process.env.ZELDAPDV_AI_WEBHOOK_URL ?? '').trim();
const AI_SECRET = String(process.env.ZELDAPDV_WEBHOOK_SECRET ?? process.env.CRM_WEBHOOK_SECRET ?? '');
const AI_TIMEOUT_MS = Number(process.env.ZELDAPDV_AI_TIMEOUT_MS || 20000);
type Provider = 'n8n' | 'gemini' | 'gateway';

async function selectedProvider(): Promise<Provider> {
  try {
    const result = await pool.query('SELECT data FROM app_state WHERE id = $1', [1]);
    const stored = result.rows[0]?.data?.integrations?.ai?.provider;
    if (stored === 'n8n' || stored === 'gemini' || stored === 'gateway') return stored;
  } catch { /* A tabela pode ainda não existir durante o boot. */ }
  const env = String(process.env.ZELDAPDV_AI_PROVIDER || 'n8n').toLowerCase();
  return env === 'gemini' || env === 'gateway' ? env : 'n8n';
}

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
      body: JSON.stringify({ text: args.text, menu: args.menu, history: args.history }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && typeof data === 'object' ? parseGeminiDecision(JSON.stringify(data)) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Seleciona o agente isolado desta instância; gateway privado falha fechado. */
export async function interpretWithFallback(args: {
  text: string;
  menu: MenuPublico;
  history: { sender: 'customer' | 'automation'; text: string }[];
}): Promise<GeminiDecision | null> {
  const provider = await selectedProvider();
  if (provider === 'gateway') {
    const result = await interpretOpenAiCompatible(args).catch(() => null);
    if (result) return result;
    return process.env.ZELDAPDV_AI_FALLBACK_TO_GEMINI === 'true' && geminiEnabled ? interpretMessage(args) : null;
  }
  if (provider === 'gemini') return interpretMessage(args);
  const remote = await getAiDecision(args).catch(() => null);
  if (remote && remote.intent) return remote;
  return process.env.ZELDAPDV_AI_FALLBACK_TO_GEMINI === 'true' && geminiEnabled ? interpretMessage(args) : null;
}
