/**
 * Purchase status enum for business model transactions
 * Defines the lifecycle states of a purchase transaction
 */
export enum PurchaseStatusEnum {
    /** Purchase is pending confirmation */
    PENDING = 'pending',
    /** Purchase has been completed successfully */
    COMPLETED = 'completed',
    /** Purchase was cancelled before completion */
    CANCELLED = 'cancelled',
    /** Purchase was refunded after completion */
    REFUNDED = 'refunded',
    /** Purchase failed due to payment issues */
    FAILED = 'failed'
}
