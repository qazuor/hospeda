/**
 * Every word the payment receipt PDF prints (HOS-2566, redesigned in HOS-2682).
 *
 * Spanish only, like the "Recibimos tu pago" email the link comes from: the
 * document is for the Argentine market and the mail has no other locale. The
 * strings live here, in one place, so the layout module holds no copy.
 *
 * The document is a "Comprobante de pago" and never says "Factura": it is not a
 * tax invoice and states so on its face ({@link RECEIPT_NON_FISCAL_NOTICE}).
 *
 * @module services/payment-receipt/receipt-copy
 */

/** Non-fiscal notice, identical in wording to the email's. */
export const RECEIPT_NON_FISCAL_NOTICE =
    'Este comprobante es no fiscal: no es una factura. Sirve como constancia de tu pago.';

/** Fixed labels of the document. */
export const RECEIPT_COPY = {
    brand: 'Hospeda',
    tagline: 'Turismo en el Litoral',
    title: 'Comprobante de pago',
    numberPrefix: 'N.º',
    paidBy: 'Pagado por',
    account: 'Cuenta en Hospeda',
    receiptNumber: 'Número',
    issuedAt: 'Fecha de emisión',
    paidAt: 'Fecha de pago',
    tableConcept: 'Concepto',
    tablePeriod: 'Período',
    tableAmount: 'Importe',
    subscription: 'Suscripción',
    addon: 'Complemento',
    plan: 'Plan',
    cycle: 'Ciclo',
    promo: 'Promoción aplicada',
    total: 'Total pagado',
    manualAmount: 'Pago registrado por Hospeda',
    paymentDetails: 'Datos del pago',
    method: 'Método',
    operationId: 'N.º de operación',
    manualReference: 'Referencia',
    currency: 'Moneda',
    periodRange: 'al',
    thanks: 'Gracias por confiar en Hospeda.',
    noticeTitle: 'Comprobante no fiscal'
} as const;

/** How each payment method reads on the document. */
export const RECEIPT_METHOD_LABELS = {
    MERCADOPAGO: 'Mercado Pago',
    MANUAL: 'Pago manual registrado por Hospeda',
    OTHER: 'Pago en línea'
} as const;

/** Vertical names, as the plans pages call them. Unknown ids print nothing. */
export const RECEIPT_VERTICAL_LABELS: Readonly<Record<string, string>> = {
    accommodation: 'Alojamiento',
    venue: 'Comer y salir',
    experience: 'Experiencias',
    tourist: 'Turista VIP',
    partner: 'Aliados'
};

/** Billing cycles. Unknown values print nothing. */
export const RECEIPT_CYCLE_LABELS: Readonly<Record<string, string>> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual'
};

/** Currency names; any other code prints as the code itself. */
export const RECEIPT_CURRENCY_LABELS: Readonly<Record<string, string>> = {
    ARS: 'Pesos argentinos (ARS)',
    USD: 'Dólares estadounidenses (USD)'
};
