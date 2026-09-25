/* Mapeamento de métodos de pagamento do PDV para os códigos oficiais da SEFAZ (tPag).
   Aplicável às notas NFC-e (modelo 65) e NF-e (modelo 55).
   Os tipos VendaPagamentoType/PaymentMethod e CardapioFoodType são ambientais (globais). */

export const TPAG = {
    DINHEIRO: '01',
    CARTAO_CREDITO: '03',
    CARTAO_DEBITO: '04',
    CREDITO_LOJA: '05',
    PIX: '17',
    OUTROS: '99',
} as const;

/* Cada forma de pagamento interna do ZeldaPDV mapeia para um código tPag da SEFAZ.
   Nota: o app não distingue crédito/débito de cartão hoje — pela especificação,
   cartão → 03 (crédito). Ajuste o laço abaixo se houver distinção no checkout. */
export const paymentToTPag: Record<VendaPagamentoType['metodo'], string> = {
    dinheiro: TPAG.DINHEIRO,
    cartao: TPAG.CARTAO_CREDITO,
    pix: TPAG.PIX,
    fiado: TPAG.CREDITO_LOJA,
};

export function metodoToTPag(metodo: VendaPagamentoType['metodo']): string {
    return paymentToTPag[metodo] ?? TPAG.OUTROS;
}
