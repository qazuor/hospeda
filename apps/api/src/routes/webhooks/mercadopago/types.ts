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
    /**
     * Target accommodation for a `requiresAccommodationTarget` add-on
     * (`visibility-boost-7d`/`-30d` — SPEC-309 OQ-3), when the payment carries
     * one. `undefined` for every owner-wide add-on, and for a target-required
     * add-on whose payment metadata lost the key (HOS-675).
     *
     * `confirmAddonPurchase` needs this to write the
     * `featured_listing_addon_grants` row that ties the purchase to a single
     * accommodation — without it the featured-listing reconciler cannot tell
     * which listing the add-on protects, and expiry cannot tell which listing
     * to un-feature.
     */
    accommodationId?: string;
}
