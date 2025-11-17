/**
 * Refund status enum for business model billing
 * Defines the core refund states for the billing system
 */
export enum RefundStatusEnum {
    /** Refund is pending */
    PENDING = 'pending',
    /** Refund is being processed */
    PROCESSING = 'processing',
    /** Refund has been completed */
    COMPLETED = 'completed',
    /** Refund has failed */
    FAILED = 'failed',
    /** Refund was cancelled */
    CANCELLED = 'cancelled'
}
