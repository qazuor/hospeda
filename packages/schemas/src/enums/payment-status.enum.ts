/**
 * Payment status enum
 * Defines the lifecycle states of a payment transaction
 */
export enum PaymentStatusEnum {
    /** Payment is awaiting processing */
    PENDING = 'pending',
    /** Payment has been authorized but not captured */
    AUTHORIZED = 'authorized',
    /** Payment has been successfully captured */
    CAPTURED = 'captured',
    /** Payment was declined by the payment processor */
    DECLINED = 'declined',
    /** Payment processing failed */
    FAILED = 'failed',
    /** Payment was cancelled before completion */
    CANCELLED = 'cancelled',
    /** Payment has been fully refunded */
    REFUNDED = 'refunded',
    /** Payment has been partially refunded */
    PARTIALLY_REFUNDED = 'partially_refunded'
}
