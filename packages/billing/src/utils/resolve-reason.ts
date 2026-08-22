/**
 * @file resolve-reason.ts
 * @description Maps MercadoPago `status_detail` codes to i18n reason keys so a
 * rejected payment can be explained to the payer in plain language instead of
 * the provider's internal code.
 *
 * Lives in `@repo/billing` (HOS-764) because the same mapping is needed on both
 * sides of the payment flow: the `apps/web` checkout failure page renders it on
 * the MercadoPago return, and the `apps/api` payment-failed notification needs
 * it for the email body. It previously lived in `apps/web/src/lib/checkout/`,
 * which is why the email still shipped the raw code.
 *
 * The returned value is an i18n KEY, never a rendered string: the caller owns
 * the locale. The web page resolves it in the visitor's language; the
 * payment-failed email resolves it in Spanish (see
 * `apps/api/src/services/payment-failure-reason.ts`) because the rest of that
 * email body is hardcoded Spanish — a single translated line inside an
 * otherwise Spanish message reads worse than a coherent one. Full email i18n is
 * separate, future work.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE CATEGORIES PROMISE (HOS-764 phase 2)
 * ---------------------------------------------------------------------------
 *
 * A category is a claim about WHY the payment failed, and the payer acts on it.
 * Three of them used to make a claim MercadoPago's own documentation
 * contradicts, and they were corrected:
 *
 * - `cc_rejected_high_risk` said "insufficient funds". MercadoPago classifies
 *   it as a fraud-prevention block, so the old copy was both false and
 *   insulting. It now has its own `reasonHighRisk` category.
 * - `cc_rejected_bad_filled_security_code` said "the card was declined".
 *   MercadoPago documents it as a CVV typo — a ten-second fix, but only if we
 *   say so. It now has its own `reasonSecurityCode` category.
 * - `cc_rejected_card_disabled` said "the card has expired". A blocked or
 *   disabled card is a different problem with a different fix. It now has its
 *   own `reasonCardDisabled` category.
 *
 * `cc_rejected_invalid_installments` was not mapped at all and fell through to
 * the generic message; it now has `reasonInvalidInstallments`.
 *
 * ---------------------------------------------------------------------------
 * CODES DELIBERATELY ABSENT — DO NOT "RESTORE" THEM
 * ---------------------------------------------------------------------------
 *
 * `rejected_insufficient_data`, `rejected_by_bank` and
 * `cc_rejected_card_type_not_allowed` were removed in HOS-764 phase 2: none of
 * them exists in MercadoPago's documented `status_detail` vocabulary, so no
 * payment ever carried them and no branch of this mapper ever matched them.
 * They looked like coverage while providing none. If a future reader misses
 * them, the reason they are gone is that they were never real — verify against
 * the reference URL below before adding any code to these lists.
 *
 * There is likewise no `reasonExpired` category any more: MercadoPago has no
 * dedicated "expired card" code. An expiry problem surfaces as
 * `cc_rejected_bad_filled_date`, which maps to `reasonInvalidData`.
 *
 * Reference: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/response-handling/collection-results
 */

/**
 * Valid i18n reason key suffixes for checkout failure messages.
 * Each value corresponds to a `billing.checkout.failure.*` i18n key.
 */
export type CheckoutReasonKey =
    | 'reasonInsufficientFunds'
    | 'reasonHighRisk'
    | 'reasonCardDeclined'
    | 'reasonSecurityCode'
    | 'reasonCardDisabled'
    | 'reasonInvalidInstallments'
    | 'reasonInvalidData'
    | 'genericMessage';

/**
 * Full i18n key type for checkout failure reason messages.
 */
export type CheckoutReasonI18nKey =
    | 'billing.checkout.failure.reasonInsufficientFunds'
    | 'billing.checkout.failure.reasonHighRisk'
    | 'billing.checkout.failure.reasonCardDeclined'
    | 'billing.checkout.failure.reasonSecurityCode'
    | 'billing.checkout.failure.reasonCardDisabled'
    | 'billing.checkout.failure.reasonInvalidInstallments'
    | 'billing.checkout.failure.reasonInvalidData'
    | 'billing.checkout.failure.genericMessage';

const INSUFFICIENT_FUNDS_PATTERNS = ['cc_rejected_insufficient_amount'] as const;

/** Fraud-prevention blocks. Never phrased as a funds problem — see file docs. */
const HIGH_RISK_PATTERNS = ['cc_rejected_high_risk'] as const;

const CARD_DECLINED_PATTERNS = [
    'cc_rejected_call_for_authorize',
    'cc_rejected_blacklist',
    'cc_rejected_max_attempts',
    'cc_rejected_other_reason'
] as const;

/** CVV typo — actionable by the payer in seconds if we name it. */
const SECURITY_CODE_PATTERNS = ['cc_rejected_bad_filled_security_code'] as const;

/** Card blocked or disabled by the issuer. NOT the same as expired. */
const CARD_DISABLED_PATTERNS = ['cc_rejected_card_disabled'] as const;

/** Instalment plan the issuer will not accept for this card. */
const INVALID_INSTALLMENTS_PATTERNS = ['cc_rejected_invalid_installments'] as const;

const INVALID_DATA_PATTERNS = [
    'cc_rejected_bad_filled_card_number',
    'cc_rejected_bad_filled_date',
    'cc_rejected_bad_filled_other',
    'cc_rejected_duplicated_payment'
] as const;

/**
 * Ordered lookup table. Each entry is an exact-match pattern list paired with
 * the reason key it resolves to; the first matching entry wins. Codes are
 * disjoint across lists, so the order is documentation rather than precedence.
 */
const REASON_GROUPS: ReadonlyArray<readonly [ReadonlyArray<string>, CheckoutReasonKey]> = [
    [INSUFFICIENT_FUNDS_PATTERNS, 'reasonInsufficientFunds'],
    [HIGH_RISK_PATTERNS, 'reasonHighRisk'],
    [CARD_DECLINED_PATTERNS, 'reasonCardDeclined'],
    [SECURITY_CODE_PATTERNS, 'reasonSecurityCode'],
    [CARD_DISABLED_PATTERNS, 'reasonCardDisabled'],
    [INVALID_INSTALLMENTS_PATTERNS, 'reasonInvalidInstallments'],
    [INVALID_DATA_PATTERNS, 'reasonInvalidData']
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
 * resolveReasonKey('cc_rejected_high_risk');           // 'reasonHighRisk'
 * resolveReasonKey(null);                              // 'genericMessage'
 * resolveReasonKey('unknown_code');                    // 'genericMessage'
 * ```
 */
export const resolveReasonKey = (statusDetail: string | null | undefined): CheckoutReasonKey => {
    if (!statusDetail) return 'genericMessage';
    for (const [patterns, reasonKey] of REASON_GROUPS) {
        if (patterns.includes(statusDetail)) return reasonKey;
    }
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
