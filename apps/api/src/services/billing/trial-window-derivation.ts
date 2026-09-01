/**
 * Derivation of the REAL trial window from a MercadoPago preapproval (HOS-936).
 *
 * ## The measurement this exists because of
 *
 * MercadoPago reports a `free_trial` it does not intend to honour, and it does
 * so in a way that is byte-identical to a trial it does honour. Measured
 * 2026-08-31 against the live API with two preapprovals for the SAME payer on
 * the SAME plan, created two seconds apart:
 *
 * | field | 1st preapproval | 2nd preapproval |
 * | ----- | --------------- | --------------- |
 * | `auto_recurring.free_trial` | `{frequency: 30, frequency_type: 'days'}` | **identical** |
 * | `first_invoice_offset` | `30` | **identical** |
 * | `date_created` | `2026-08-31T03:28:02` | `2026-08-31T03:28:04` |
 * | `next_payment_date` | `2026-09-29` (+30 days) | `2026-08-31T03:28:04` — creation instant |
 *
 * MercadoPago grants a preapproval's free trial once per
 * `(payer, preapproval_plan)`. The second subscription is the same payer
 * subscribing again, so the trial is spent — but only `next_payment_date` says
 * so. `free_trial` and `first_invoice_offset` describe the PLAN'S TERMS, which
 * are the same object for both, and therefore cannot discriminate between a
 * trial that will run and a trial that was already consumed.
 *
 * ## The rule
 *
 * Derive the trial from `next_payment_date - date_created`. **Never** from
 * `free_trial`, and never from `first_invoice_offset`. `next_payment_date` is
 * the only field that is a statement about THIS subscription rather than about
 * the plan, so it is the only one that can be wrong in only one direction —
 * and it is what MercadoPago itself will act on.
 *
 * A static guard (`scripts/check-trial-not-derived-from-free-trial.sh`) keeps
 * the rule from being quietly reverted.
 *
 * ## Where this sits relative to HOS-522
 *
 * {@link ../trial-promise-verification | `trial-promise-verification.ts`}
 * answers the same question from the OTHER end of time: it waits for a charge
 * to settle and asks whether it landed too early to be a legitimate end-of-trial
 * conversion. That remains the last word, because settled money cannot lie.
 *
 * This module is the FIRST word: the creation response already carries the
 * verdict, so the local `trial_end` can be written correctly at checkout instead
 * of being written optimistically and corrected days later — if a webhook
 * arrives at all.
 *
 * @module services/billing/trial-window-derivation
 */

/**
 * What a preapproval's own dates say about the trial it was created with.
 *
 * - `granted` — the provider deferred the first charge, so a real free window
 *   exists and {@link DeriveTrialWindowResult.trialEnd} is when it ends.
 * - `not-granted` — the provider is charging at (or effectively at) creation
 *   time. Whatever `free_trial` claims, there is no free window.
 * - `unknown` — the dates needed to decide were absent or unparseable. The
 *   caller must NOT infer either verdict from this; it means "do not touch
 *   what is already stored".
 */
export type TrialGrantOutcome = 'granted' | 'not-granted' | 'unknown';

/**
 * Input for {@link deriveTrialWindowFromPreapproval}.
 *
 * Both fields accept `null` and `undefined` on purpose: callers hand them
 * straight from a JSON response or a partially-projected row, and an absent key
 * yields `undefined` where a present-but-empty one yields `null`. Collapsing
 * only one of the two would let the other fall through to arithmetic on a
 * missing date.
 */
export interface DeriveTrialWindowInput {
    /** The preapproval's `date_created` — when MercadoPago created it. */
    readonly dateCreated: Date | null | undefined;
    /**
     * The preapproval's `next_payment_date` — when MercadoPago will take the
     * first charge. The ONLY field in the response that is a statement about
     * this subscription rather than about its plan.
     */
    readonly nextPaymentDate: Date | null | undefined;
}

/**
 * Result of {@link deriveTrialWindowFromPreapproval}.
 */
export interface DeriveTrialWindowResult {
    /** The verdict. */
    readonly outcome: TrialGrantOutcome;
    /**
     * When the free window ends — i.e. `next_payment_date`, because the first
     * charge IS the end of the trial. `null` for every outcome but `granted`.
     *
     * Deliberately the provider's own date rather than
     * `date_created + N days` recomputed from a day count: the provider's date
     * is what it will actually act on, and re-deriving it would reintroduce the
     * arithmetic that `free_trial` already got wrong.
     */
    readonly trialEnd: Date | null;
    /**
     * `next_payment_date - date_created` in ms — how long the first charge was
     * deferred by. `null` when the dates could not be read. Recorded so callers
     * can log the measurement without recomputing it.
     */
    readonly deferralMs: number | null;
}

/**
 * How far the first charge must be deferred before it counts as a real trial.
 *
 * One hour. Every real observation sits three orders of magnitude away from it,
 * in one direction or the other:
 *
 * - A **denied** trial charges cycle 1 at creation: the measurement above put
 *   `next_payment_date` at the creation instant itself — a deferral of zero.
 * - A **granted** trial is at minimum one whole day, because MercadoPago's
 *   `free_trial.frequency_type` is `days` and a zero-day trial is not a trial.
 *   The shortest plan Hospeda could ship therefore defers by 24 hours.
 *
 * So the threshold separates the two populations by a factor of 24 on the tight
 * side and by 720 on the loose one, and cannot be tripped by clock skew between
 * MercadoPago's clock and ours, by the seconds an authorization takes, or by
 * the sub-second difference the measurement actually recorded.
 *
 * An absolute duration is right here where {@link
 * ../trial-promise-verification | HOS-522}'s sibling threshold is a fraction:
 * that one compares a charge against a window whose length varies per plan, so
 * it has to scale. This one compares two timestamps on one response, where the
 * only two possible answers are "zero" and "at least a day".
 */
const MIN_DEFERRAL_MS_FOR_A_GRANTED_TRIAL = 60 * 60 * 1000;

/**
 * Decide, from a preapproval's own timestamps, whether MercadoPago actually
 * granted the free trial that was asked for.
 *
 * Pure and total: every input shape returns a verdict, and no input throws.
 *
 * @param input - The preapproval's `date_created` and `next_payment_date`.
 * @returns The verdict, the real trial end when there is one, and the deferral
 *   the verdict was derived from.
 *
 * @example
 * ```ts
 * // HOS-936, 1st preapproval: MercadoPago deferred the charge by 30 days.
 * // (The finding writes that date as 2026-09-29, its Argentina `-04:00` form.)
 * deriveTrialWindowFromPreapproval({
 *   dateCreated: new Date('2026-08-31T03:28:02Z'),
 *   nextPaymentDate: new Date('2026-09-30T03:28:02Z')
 * }); // → { outcome: 'granted', trialEnd: 2026-09-30T03:28:02Z, ... }
 *
 * // HOS-936, 2nd preapproval: same payer, same plan, two seconds later.
 * // `free_trial` is IDENTICAL to the one above; `next_payment_date` is not.
 * deriveTrialWindowFromPreapproval({
 *   dateCreated: new Date('2026-08-31T03:28:04Z'),
 *   nextPaymentDate: new Date('2026-08-31T03:28:04Z')
 * }); // → { outcome: 'not-granted', trialEnd: null, deferralMs: 0 }
 * ```
 */
export function deriveTrialWindowFromPreapproval(
    input: DeriveTrialWindowInput
): DeriveTrialWindowResult {
    const { dateCreated, nextPaymentDate } = input;

    const unknown = { outcome: 'unknown', trialEnd: null, deferralMs: null } as const;

    if (dateCreated == null || nextPaymentDate == null) {
        return unknown;
    }

    const createdMs = dateCreated.getTime();
    const nextPaymentMs = nextPaymentDate.getTime();

    // An unparseable timestamp cannot support a verdict in EITHER direction.
    // Returning `not-granted` here would strip a trial the provider may well be
    // honouring, purely because we could not read a date.
    if (Number.isNaN(createdMs) || Number.isNaN(nextPaymentMs)) {
        return unknown;
    }

    const deferralMs = nextPaymentMs - createdMs;

    // A first charge dated BEFORE creation is not a short trial, it is a
    // response we do not understand. Fail to `unknown` rather than reading a
    // negative deferral as an emphatic "no trial".
    if (deferralMs < 0) {
        return { outcome: 'unknown', trialEnd: null, deferralMs };
    }

    if (deferralMs < MIN_DEFERRAL_MS_FOR_A_GRANTED_TRIAL) {
        return { outcome: 'not-granted', trialEnd: null, deferralMs };
    }

    return { outcome: 'granted', trialEnd: nextPaymentDate, deferralMs };
}

/**
 * Parse one timestamp off a raw MercadoPago preapproval JSON field.
 *
 * MercadoPago returns ISO-8601 strings with an offset (`2026-08-31T03:28:02.000-04:00`).
 * Anything that is not a usable date collapses to `null`, which
 * {@link deriveTrialWindowFromPreapproval} turns into `unknown`.
 *
 * @param value - The raw field value, straight off `JSON.parse`.
 * @returns The parsed date, or `null` when the field is absent or unusable.
 */
function parsePreapprovalDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== 'string' || value === '') {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Read the two honest fields off an untyped preapproval object and derive the
 * trial window from them.
 *
 * Accepts `unknown` because the shapes that reach this differ by call site: a
 * raw `GET /preapproval/{id}` body (snake_case), a webhook payload, or qzpay's
 * mapped `QZPayProviderSubscription` (which carries NEITHER field, and therefore
 * correctly yields `unknown` rather than a fabricated verdict).
 *
 * Both spellings are read — `next_payment_date` as MercadoPago sends it, and
 * `nextPaymentDate` for any caller that already camelCased the payload — so a
 * mapping layer between the provider and this function does not silently turn a
 * real verdict into `unknown`.
 *
 * @param preapproval - The preapproval object, in whatever shape the caller has.
 * @returns The same verdict {@link deriveTrialWindowFromPreapproval} returns.
 *
 * @example
 * ```ts
 * const live = await fetch(`${MP}/preapproval/${id}`).then((r) => r.json());
 * const { outcome, trialEnd } = readTrialWindowFromPreapprovalPayload(live);
 * ```
 */
export function readTrialWindowFromPreapprovalPayload(
    preapproval: unknown
): DeriveTrialWindowResult {
    if (typeof preapproval !== 'object' || preapproval === null) {
        return { outcome: 'unknown', trialEnd: null, deferralMs: null };
    }
    const record = preapproval as Record<string, unknown>;

    return deriveTrialWindowFromPreapproval({
        dateCreated: parsePreapprovalDate(record.date_created ?? record.dateCreated),
        nextPaymentDate: parsePreapprovalDate(record.next_payment_date ?? record.nextPaymentDate)
    });
}
