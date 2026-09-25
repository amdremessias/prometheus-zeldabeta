/* Validações de entrada comuns (lado servidor). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* E-mail: formato + comprimento máximo. */
export function isValidEmail(email: string): boolean {
    return email.length <= 200 && EMAIL_RE.test(email);
}

/* String: não vazia e dentro do limite. */
export function isNonEmptyString(value: string, max: number): boolean {
    return value.length > 0 && value.length <= max;
}

/* Número finito dentro de [min, max]. */
export function isFiniteInRange(value: number, min: number, max: number): boolean {
    return Number.isFinite(value) && value >= min && value <= max;
}

/* Limites padrão. */
export const MAX_NAME = 80;
export const MAX_EMAIL = 200;
export const MAX_PASSWORD = 128;
export const MAX_PHONE = 30;
export const MAX_ADDRESS = 200;
export const MAX_NOTES = 500;
export const MAX_ITEMS = 100;
export const MAX_STATE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB por imagem

/* MIME types de imagem aceitos. */
export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export function isAllowedImageMime(mime: string): boolean {
    return ALLOWED_IMAGE_MIMES.includes(mime as (typeof ALLOWED_IMAGE_MIMES)[number]);
}

/* Valida data URL de imagem (data:image/<mime>;base64,...) e tamanho. */
export function isValidImageDataUrl(dataUrl: string): boolean {
    if (!dataUrl.startsWith('data:image/')) return false;
    const semi = dataUrl.indexOf(';');
    if (semi === -1) return false;
    const mime = dataUrl.slice(5, semi);
    if (!isAllowedImageMime(mime)) return false;
    if (!dataUrl.startsWith('base64,', semi + 1)) return false;
    const b64 = dataUrl.slice(semi + 8);
    const bytes = Math.ceil((b64.length * 3) / 4);
    return bytes <= MAX_IMAGE_BYTES;
}