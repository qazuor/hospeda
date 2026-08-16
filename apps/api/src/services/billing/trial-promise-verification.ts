/**
 * Verification of the trial promise against what MercadoPago actually did
 * (H-137).
 *
 * ## The gap this closes
 *
 * MercadoPago grants a preapproval's `free_trial` **once per
 * `(payer, preapproval_plan)`**. Hospeda decides trial eligibility per
 * `billing_customers.id` (`resolveCheckoutFreeTrialDays`). Those are two
 * criteria over two different subjects, and nothing reconciles them — so a
 * payer who already consumed the trial on a shared `preapproval_plan` is
 * promised "14 días gratis" on screen and charged the full first cycle minutes
 * later. Verified in production on 2026-08-14: promise at 16:46:17, MercadoPago
 * charged $18.000 at 16:48:16.
 *
 * ## Why the charge is the instrument, and not a live MercadoPago read
 *
 * The obvious probe — ask MercadoPago whether the trial was applied — has no
 * usable signal:
 *
 * - `auto_recurring.free_trial` describes the **plan's terms**, not "this
 *   subscription is currently on a trial". MercadoPago keeps reporting it after
 *   the day-N charge, which is why `livePreapprovalHasFreeTrial`
 *   (`routes/webhooks/mercadopago/subscription-logic.ts`) is documented as
 *   always returning `false` against qzpay's real mapped shape.
 * - `next_payment_date` does discriminate, but only inside the ~90 second window
 *   between authorization and the first charge, and it rolls forward to the next
 *   cycle right after — so a webhook that arrives late reads as "granted".
 *
 * A **settled charge that lands before the promised trial could plausibly have
 * elapsed** has neither problem. It is recorded in our own database, it cannot
 * arrive late in a way that flips the verdict, and it is not an inference: money
 * moving during a period we sold as free is the broken promise itself.
 *
 * @module services/billing/trial-promise-verification
 */

/**
 * What a settled first charge says about the trial that was promised.
 *
 * - `no-trial-promised` — the subscription carries no usable trial window, so
 *   the charge is an ordinary one and there is no promise to check.
 * - `trial-elapsed` — the charge landed late enough to be the legitimate
 *   end-of-trial conversion.
 * - `trial-not-granted` — the charge landed so early that the promised trial
 *   cannot have run. The provider ignored the `free_trial` we asked for.
 */
export type SettledTrialChargeOutcome =
    | 'no-trial-promised'
    | 'trial-elapsed'
    | 'trial-not-granted';

/**
 * Input for {@link classifySettledTrialCharge}.
 */
export interface ClassifySettledTrialChargeInput {
    /**
     * `billing_subscriptions.trial_start` — when the promised trial began.
     *
     * Accepts `undefined` as well as `null` on purpose: callers hand this
     * straight from a database row projection, and a projection that simply
     * does not select the column yields `undefined`. Collapsing only `null`
     * would let that case fall through to arithmetic on a missing date.
     */
    readonly trialStart: Date | null | undefined;
    /** `billing_subscriptions.trial_end` — when the promised trial was to end. */
    readonly trialEnd: Date | null | undefined;
    /** When the provider's charge actually settled. */
    readonly chargedAt: Date;
}

/**
 * Result of {@link classifySettledTrialCharge}.
 */
export interface ClassifySettledTrialChargeResult {
    /** The verdict. */
    readonly outcome: SettledTrialChargeOutcome;
    /** Length of the promised trial window in ms, or `null` when none was promised. */
    readonly promisedTrialMs: number | null;
    /** How much of that window had elapsed when the charge settled, in ms. */
    readonly elapsedAtChargeMs: number | null;
}

/**
 * Fraction of the promised trial window a legitimate end-of-trial charge must
 * have reached.
 *
 * A charge below this fraction is treated as proof the trial was never granted.
 * `0.5` is deliberately the widest possible margin rather than a tight one:
 *
 * - A **legitimate** charge can never land early. MercadoPago counts the trial
 *   from the moment the payer authorizes the preapproval, which is always
 *   *after* the checkout timestamp `trial_start` is computed from — so the real
 *   day-N charge lands at or past 100% of the local window, never before it.
 * - A **denied** trial charges cycle 1 immediately: ~0% in production (two
 *   minutes into a fourteen-day window).
 *
 * Everything real sits at one end or the other, so the threshold cannot be
 * tripped by clock skew, webhook lag, or a slow authorization. Expressing it as
 * a fraction rather than a fixed tolerance is what keeps it correct for a
 * 1-day QA plan and a 30-day host plan alike — a fixed "24 hours early" rule
 * would never fire on the former and would sit uncomfortably close on the
 * latter.
 */
const MIN_ELAPSED_FRACTION_FOR_LEGITIMATE_CHARGE = 0.5;

/**
 * Decide whether a settled first charge is the legitimate end of a trial or
 * proof that the provider never granted the trial we promised.
 *
 * Pure and total: every input shape returns a verdict, and no input throws.
 *
 * @param input - The promised trial window and when the charge settled.
 * @returns The verdict plus the two measurements it was derived from, so the
 *   caller can record them on the audit event without recomputing.
 *
 * @example
 * ```ts
 * // Production H-137: promised 14 days, charged 119 seconds in.
 * classifySettledTrialCharge({
 *   trialStart: new Date('2026-08-14T16:46:17Z'),
 *   trialEnd: new Date('2026-08-28T16:46:17Z'),
 *   chargedAt: new Date('2026-08-14T16:48:16Z')
 * }); // → { outcome: 'trial-not-granted', ... }
 * ```
 */
export function classifySettledTrialCharge(
    input: ClassifySettledTrialChargeInput
): ClassifySettledTrialChargeResult {
    const { trialStart, trialEnd, chargedAt } = input;

    const noPromise = {
        outcome: 'no-trial-promised',
        promisedTrialMs: null,
        elapsedAtChargeMs: null
    } as const;

    if (trialStart == null || trialEnd == null) {
        return noPromise;
    }

    const startMs = trialStart.getTime();
    const endMs = trialEnd.getTime();
    const chargedMs = chargedAt.getTime();

    // An unparseable timestamp cannot support an accusation. Fail open: a missed
    // detection costs a log line, whereas a false one tells a paying customer we
    // broke a promise we actually kept.
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(chargedMs)) {
        return noPromise;
    }

    const promisedTrialMs = endMs - startMs;

    // A non-positive window is not a trial anybody was promised — it is a
    // degenerate row (equal timestamps, or a trial_end written before its
    // start). Treating it as "not granted" would flood the audit trail with
    // findings about subscriptions that never advertised a free period.
    if (promisedTrialMs <= 0) {
        return noPromise;
    }

    const elapsedAtChargeMs = chargedMs - startMs;
    const outcome: SettledTrialChargeOutcome =
        elapsedAtChargeMs < promisedTrialMs * MIN_ELAPSED_FRACTION_FOR_LEGITIMATE_CHARGE
            ? 'trial-not-granted'
            : 'trial-elapsed';

    return { outcome, promisedTrialMs, elapsedAtChargeMs };
}
