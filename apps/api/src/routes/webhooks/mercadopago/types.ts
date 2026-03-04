/**
 * Shared types for MercadoPago webhook processing.
 *
 * @module routes/webhooks/mercadopago/types
 */

/**
 * Extracted payment information from a webhook event payload.
 */
export interface PaymentInfo {
    /** Payment amount in the specified currency */
    amount: number;
    /** Currency code (default: 'ARS') */
    currency: string;
    /** Payment status from MercadoPago */
    status: string;
    /** Detailed status reason, if available */
    statusDetail: string | null;
    /** Payment method identifier, if available */
    paymentMethod: string | null;
}

/**
 * Add-on metadata extracted from a payment event.
 */
export interface AddonMetadata {
    /** Slug identifier for the add-on product */
    addonSlug: string;
    /** Billing customer ID associated with the purchase */
    customerId: string;
}
