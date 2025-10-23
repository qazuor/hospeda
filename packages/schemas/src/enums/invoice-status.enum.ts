/**
 * Invoice status enum for billing system
 * Defines the lifecycle states of invoices
 */
export enum InvoiceStatusEnum {
    /** Invoice is open and awaiting payment */
    OPEN = 'open',
    /** Invoice has been paid */
    PAID = 'paid',
    /** Invoice has been voided/cancelled */
    VOID = 'void'
}
