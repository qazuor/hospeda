/**
 * Refund status enum
 * Defines the lifecycle states of a refund request
 */
export enum RefundStatusEnum {
    /** Refund request is awaiting review */
    PENDING = 'pending',
    /** Refund has been approved */
    APPROVED = 'approved',
    /** Refund is being processed */
    PROCESSING = 'processing',
    /** Refund has been completed successfully */
    COMPLETED = 'completed',
    /** Refund processing failed */
    FAILED = 'failed',
    /** Refund request was rejected */
    REJECTED = 'rejected'
}
