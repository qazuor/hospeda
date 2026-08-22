/**
 * Shared types for MercadoPago webhook processing.
 *
 * @module routes/webhooks/mercadopago/types
 */

import type { Major } from '@repo/billing';

/**
 * Extracted payment information from a webhook event payload.
 */
export interface PaymentInfo {
    /**
     * Payment amount in MAJOR units (ARS pesos) of {@link PaymentInfo.currency}.
     *
     * HOS-720 — the unit is in the type, not in this comment. `extractPaymentInfo`
     * is the canonical consumer that ESTABLISHES that an MP-raw-shaped
     * `transaction_amount` is read as major units, so every producer of that
     * shape (the live webhook handler and the polling cron, both of which start
     * from a qzpay adapter response in CENTAVOS) must convert before it gets
     * here — and now cannot forget to, because `Centavos` does not type-check as
     * `Major`. Converting back to centavos for the ledger is `toCentavos`.
     */
    amount: Major;
    /** Currency code (default: 'ARS') */
    currency: string;
    /**
     * Payment status, in the QZPay-NORMALIZED vocabulary
     * (`pending | processing | succeeded | failed | canceled | refunded |
     * partially_refunded | disputed`), NOT MercadoPago's raw one.
     *
     * HOS-757 — every producer that reaches `processPaymentUpdated` hands over a
     * status the qzpay MercadoPago adapter already translated: the live webhook
     * handler forwards `QZPayProviderPayment.status` verbatim, and the polling
     * cron forwards the same field off a `payments.search` hit. Nothing between
     * the adapter and here re-translates, so a predicate written against MP's raw
     * words (`approved`, `rejected`, `cancelled`) can never be true — which is
     * exactly how four dispatches in `payment-logic.ts` stayed dormant for months.
     *
     * Typed `string` rather than `QZPayPaymentStatus` on purpose:
     * `extractPaymentInfo` reads it out of arbitrary provider JSON and must be
     * able to carry a value the union does not name (the adapter passes an
     * unrecognised MP status through verbatim). The narrowing happens at the
     * comparison, against the allowlist in `payment-logic.ts`.
     */
    status: string;
    /** Detailed status reason, if available */
    statusDetail: string | null;
    /** Payment method identifier, if available */
    paymentMethod: string | null;
}

/**
 * The MP-raw-shaped payment payload a SYNTHETIC producer builds.
 *
 * `processPaymentUpdated` takes `Record<string, unknown>` because on the live
 * webhook path it really does receive arbitrary provider JSON. That erasure is
 * exactly what let HOS-713 through: a producer assembling the same shape out of
 * a qzpay adapter response (CENTAVOS) could drop the value into
 * `transaction_amount` undivided and the compiler had nothing to object to,
 * because the destination property was `unknown`.
 *
 * A producer therefore declares its literal as THIS type, not as
 * `Record<string, unknown>`. It is a plain type alias, so it stays assignable
 * to `Record<string, unknown>` at the `processPaymentUpdated` call — but on the
 * way in, `transaction_amount` is a {@link Major} and a centavo figure does not
 * type-check. That is the whole guarantee (HOS-720).
 *
 * Only the fields a synthetic producer actually sets are modelled. Everything
 * MP-raw-only (`status_detail`, `payment_method_id`, …) is deliberately absent:
 * a synthetic payload does not have them, and the consumers that read them
 * already tolerate their absence.
 */
export type SyntheticMpPaymentPayload = {
    /** Provider payment id (MP `payment.id`). */
    readonly id: string | number;
    /** Charged amount, MAJOR units — see the type note above. */
    readonly transaction_amount: Major;
    /** Refunded-so-far amount, MAJOR units. Absent when the provider reports none. */
    readonly transaction_amount_refunded?: Major;
    /** ISO-4217 currency code. */
    readonly currency_id: string;
    /**
     * Payment status in the QZPay-NORMALIZED vocabulary (`succeeded`, `failed`,
     * `canceled`, …) — never MercadoPago's raw one.
     *
     * HOS-757: both producers hold a normalized value already — it comes
     * straight off a `QZPayProviderPayment` the adapter returned — so
     * forwarding that field verbatim is the only correct way to fill this one.
     * The polling cron used to translate back to MP's raw `'approved'` here by
     * hand, which is the divergence this note closes.
     *
     * Kept `string` rather than qzpay-core's `QZPayPaymentStatus` because
     * `QZPayProviderPayment.status` is itself `string`: the adapter passes an
     * MP status it does not recognise through verbatim, so a producer really
     * can be holding a value the union does not name, and narrowing here would
     * force every producer into a cast that asserts something untrue. The
     * enforcement lives at the comparison instead — see `settled` in
     * `payment-logic.ts`, which is the only door the money-spending branches
     * can reach an amount through.
     */
    readonly status: string;
    /** Checkout metadata bag, forwarded verbatim to the dispatch extractors. */
    readonly metadata?: unknown;
    /** MP `external_reference` (the qzpay checkout-session id). */
    readonly external_reference?: string;
};

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
