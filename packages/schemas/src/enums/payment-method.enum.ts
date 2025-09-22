/**
 * Payment method enum for Mercado Pago integration
 * Maps to Mercado Pago payment method types
 */
export enum PaymentMethodEnum {
    /** Credit card */
    CREDIT_CARD = 'credit_card',
    /** Debit card */
    DEBIT_CARD = 'debit_card',
    /** Bank transfer */
    BANK_TRANSFER = 'bank_transfer',
    /** Cash payment (Rapipago, Pago Fácil, etc.) */
    TICKET = 'ticket',
    /** Digital wallet (Mercado Pago account) */
    ACCOUNT_MONEY = 'account_money'
}
