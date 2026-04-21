/**
 * @file resolve-reason.ts
 * @description Maps MercadoPago `status_detail` codes to i18n reason keys
 * for the checkout failure page.
 *
 * Reference: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/response-handling/collection-results
 */

/**
 * Valid i18n reason key suffixes for checkout failure messages.
 * Each value corresponds to a `billing.checkout.failure.*` i18n key.
 */
export type CheckoutReasonKey =
    | 'reasonInsufficientFunds'
    | 'reasonCardDeclined'
    | 'reasonExpired'
    | 'reasonInvalidData'
    | 'genericMessage';

/**
 * Full i18n key type for checkout failure reason messages.
 */
export type CheckoutReasonI18nKey =
    | 'billing.checkout.failure.reasonInsufficientFunds'
    | 'billing.checkout.failure.reasonCardDeclined'
    | 'billing.checkout.failure.reasonExpired'
    | 'billing.checkout.failure.reasonInvalidData'
    | 'billing.checkout.failure.genericMessage';

const INSUFFICIENT_FUNDS_PATTERNS = [
    'cc_rejected_insufficient_amount',
    'cc_rejected_high_risk',
    'rejected_insufficient_data'
] as const;

const CARD_DECLINED_PATTERNS = [
    'cc_rejected_call_for_authorize',
    'cc_rejected_bad_filled_security_code',
    'cc_rejected_blacklist',
    'cc_rejected_max_attempts',
    'rejected_by_bank',
    'cc_rejected_other_reason'
] as const;

const EXPIRED_PATTERNS = [
    'cc_rejected_card_disabled',
    'cc_rejected_card_type_not_allowed'
] as const;

const INVALID_DATA_PATTERNS = [
    'cc_rejected_bad_filled_card_number',
    'cc_rejected_bad_filled_date',
    'cc_rejected_bad_filled_other',
    'cc_rejected_duplicated_payment'
] as const;

/**
 * Maps a MercadoPago `status_detail` value to a checkout failure reason key.
 *
 * Only the `status_detail` query parameter is used — never `payment_id` or
 * other sensitive identifiers.
 *
 * @param statusDetail - The raw `status_detail` value from the MP redirect URL,
 *   or `null`/`undefined` when the param is absent.
 * @returns The matching {@link CheckoutReasonKey}, defaulting to `genericMessage`
 *   for unknown or absent codes.
 *
 * @example
 * ```ts
 * resolveReasonKey('cc_rejected_insufficient_amount'); // 'reasonInsufficientFunds'
 * resolveReasonKey(null);                              // 'genericMessage'
 * resolveReasonKey('unknown_code');                    // 'genericMessage'
 * ```
 */
export const resolveReasonKey = (statusDetail: string | null | undefined): CheckoutReasonKey => {
    if (!statusDetail) return 'genericMessage';
    if ((INSUFFICIENT_FUNDS_PATTERNS as ReadonlyArray<string>).includes(statusDetail))
        return 'reasonInsufficientFunds';
    if ((CARD_DECLINED_PATTERNS as ReadonlyArray<string>).includes(statusDetail))
        return 'reasonCardDeclined';
    if ((EXPIRED_PATTERNS as ReadonlyArray<string>).includes(statusDetail)) return 'reasonExpired';
    if ((INVALID_DATA_PATTERNS as ReadonlyArray<string>).includes(statusDetail))
        return 'reasonInvalidData';
    return 'genericMessage';
};

/**
 * Maps a MercadoPago `status_detail` value to the full i18n key for the
 * checkout failure page reason message.
 *
 * Convenience wrapper around {@link resolveReasonKey} that prepends the
 * `billing.checkout.failure.` namespace prefix.
 *
 * @param statusDetail - The raw `status_detail` value from the MP redirect URL,
 *   or `null`/`undefined` when the param is absent.
 * @returns The full {@link CheckoutReasonI18nKey}.
 *
 * @example
 * ```ts
 * resolveReasonI18nKey('cc_rejected_blacklist');
 * // 'billing.checkout.failure.reasonCardDeclined'
 * ```
 */
export const resolveReasonI18nKey = (
    statusDetail: string | null | undefined
): CheckoutReasonI18nKey =>
    `billing.checkout.failure.${resolveReasonKey(statusDetail)}` as CheckoutReasonI18nKey;
