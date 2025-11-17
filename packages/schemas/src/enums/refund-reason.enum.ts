/**
 * Refund reason enum for business model billing
 * Defines the possible reasons for issuing a refund
 */
export enum RefundReasonEnum {
    /** Customer requested the refund */
    CUSTOMER_REQUEST = 'customer_request',
    /** There was a billing error */
    BILLING_ERROR = 'billing_error',
    /** Payment was duplicated */
    DUPLICATE_PAYMENT = 'duplicate_payment',
    /** Service was cancelled */
    CANCELLED_SERVICE = 'cancelled_service',
    /** Customer overpaid */
    OVERPAYMENT = 'overpayment',
    /** Transaction was fraudulent */
    FRAUDULENT_TRANSACTION = 'fraudulent_transaction',
    /** There was a technical error */
    TECHNICAL_ERROR = 'technical_error',
    /** Other reason not specified above */
    OTHER = 'other'
}
