/**
 * Payment status enum for Mercado Pago integration
 * Maps to Mercado Pago payment statuses
 */
export enum PaymentStatusEnum {
    /** Payment is pending */
    PENDING = 'pending',
    /** Payment has been approved */
    APPROVED = 'approved',
    /** Payment has been authorized (for credit cards) */
    AUTHORIZED = 'authorized',
    /** Payment is being processed */
    IN_PROCESS = 'in_process',
    /** Payment is in mediation */
    IN_MEDIATION = 'in_mediation',
    /** Payment was rejected */
    REJECTED = 'rejected',
    /** Payment was cancelled */
    CANCELLED = 'cancelled',
    /** Payment was refunded */
    REFUNDED = 'refunded',
    /** Payment was charged back */
    CHARGED_BACK = 'charged_back'
}
