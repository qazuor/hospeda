/**
 * Payment status enum for business model billing
 * Defines the core payment states for the billing system
 */
export enum PaymentStatusEnum {
    /** Payment is pending */
    PENDING = 'pending',
    /** Payment has been approved */
    APPROVED = 'approved',
    /** Payment has been authorized */
    AUTHORIZED = 'authorized',
    /** Payment is in process */
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
