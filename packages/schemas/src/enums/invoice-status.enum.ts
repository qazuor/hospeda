/**
 * Invoice status enum
 * Defines the lifecycle states of an invoice
 */
export enum InvoiceStatusEnum {
    /** Invoice is being prepared */
    DRAFT = 'draft',
    /** Invoice has been issued */
    ISSUED = 'issued',
    /** Invoice has been sent to the customer */
    SENT = 'sent',
    /** Invoice has been paid in full */
    PAID = 'paid',
    /** Invoice has been partially paid */
    PARTIAL_PAID = 'partial_paid',
    /** Invoice payment is overdue */
    OVERDUE = 'overdue',
    /** Invoice was cancelled */
    CANCELLED = 'cancelled',
    /** Invoice was voided */
    VOIDED = 'voided'
}
