/**
 * Payment-failure reason copy for the payer-facing email (HOS-764).
 *
 * The `payment_failure` notification used to ship MercadoPago's raw
 * `status_detail` — a payer read `cc_rejected_bad_filled_security_code` in their
 * inbox and had no way to act on it. The checkout failure page had solved this
 * long before, mapping the same codes to plain-language copy; phase 1 of HOS-764
 * moved that mapper out of `apps/web` into `@repo/billing` so both sides of the
 * payment flow could share it.
 *
 * This module is the email side of that share: `status_detail` in, a rendered
 * sentence out.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS LIVES IN apps/api, AND WHY IT IS ALWAYS SPANISH
 * ---------------------------------------------------------------------------
 *
 * `@repo/notifications` does not depend on `@repo/i18n` by design, so a template
 * cannot resolve a key itself — the caller hands it a finished string. That is
 * the same boundary `addon-checkout-locale.ts` sits on, and this module follows
 * its pattern exactly: the flat `trans[locale][key]` table from `@repo/i18n`,
 * because there is no React context in `apps/api` and `useTranslations()` does
 * not exist here.
 *
 * The locale is hardcoded to Spanish, deliberately, and `resolveRecipientLocale`
 * is NOT used. The rest of the payment-failure email body is hardcoded Spanish;
 * translating only this one line into the recipient's language would produce a
 * Spanish email with a single foreign sentence in the middle of it — worse than
 * a coherent one. Translating the whole email is separate, future work, and when
 * it happens this function grows a locale parameter rather than being replaced.
 *
 * The i18n KEYS are still maintained in all three locales, because the checkout
 * failure page renders the very same keys in the visitor's language.
 *
 * ---------------------------------------------------------------------------
 * THE UNKNOWN CASE IS NOT genericMessage
 * ---------------------------------------------------------------------------
 *
 * `resolveReasonKey` answers `'genericMessage'` for an absent or unrecognised
 * code, and on the web that key is right: a full-page sentence telling the
 * visitor to review the form they are looking at. In an email it is wrong — the
 * reader is not looking at a form, and the line sits under a "Reason:" label
 * where a sentence reads as a non-sequitur. So the unknown case is re-pointed at
 * `reasonUnknown`, a noun phrase written for exactly that slot.
 *
 * @module services/payment-failure-reason
 */

import { resolveReasonKey } from '@repo/billing';
import { type Locale, trans } from '@repo/i18n';

/**
 * The locale every payment-failure email reason is rendered in.
 *
 * Not a default that a caller may override — see the module docs: the email body
 * around this string is hardcoded Spanish, so a per-recipient locale here would
 * make the message incoherent rather than localized.
 */
const PAYMENT_FAILURE_REASON_LOCALE: Locale = 'es';

/** i18n key used when MercadoPago sent no usable `status_detail`. */
const UNKNOWN_REASON_KEY = 'billing.checkout.failure.reasonUnknown';

/**
 * Last-resort copy, used only if the locale table itself is missing the key
 * (a partially-built `@repo/i18n`, or a key deleted without updating this
 * module). Keeping the email sendable beats throwing inside a webhook.
 */
const UNKNOWN_REASON_FALLBACK = 'Motivo no informado por el banco';

/**
 * Renders the payer-facing failure reason for the `payment_failure` email.
 *
 * Handles the three shapes a webhook actually produces:
 * - a `status_detail` this repo maps (`cc_rejected_high_risk`, …) — the
 *   matching category's Spanish sentence;
 * - a `status_detail` present but unrecognised (a code MercadoPago added, or a
 *   non-card payment method) — the unknown-reason noun phrase, never the raw
 *   code;
 * - `status_detail` absent, `null` or empty — the same unknown-reason phrase.
 *
 * @param params.statusDetail - MercadoPago's raw `status_detail` from the
 *   payment payload, or `null`/`undefined` when the field is absent.
 * @returns A finished Spanish string, safe to place directly in the email body.
 *   Never a MercadoPago code, never an empty string.
 *
 * @example
 * resolvePaymentFailureReason({ statusDetail: 'cc_rejected_high_risk' });
 * // => 'La operación no fue autorizada por prevención de fraude'
 *
 * @example
 * resolvePaymentFailureReason({ statusDetail: null });
 * // => 'Motivo no informado por el banco'
 */
export function resolvePaymentFailureReason({
    statusDetail
}: {
    readonly statusDetail: string | null | undefined;
}): string {
    const reasonKey = resolveReasonKey(statusDetail);
    const table = trans[PAYMENT_FAILURE_REASON_LOCALE];

    // `genericMessage` is the resolver's "no idea" answer. On the web that is a
    // full-page sentence; in the email slot it is a non-sequitur — see module docs.
    if (reasonKey === 'genericMessage') {
        return table?.[UNKNOWN_REASON_KEY] ?? UNKNOWN_REASON_FALLBACK;
    }

    return (
        table?.[`billing.checkout.failure.${reasonKey}`] ??
        table?.[UNKNOWN_REASON_KEY] ??
        UNKNOWN_REASON_FALLBACK
    );
}
