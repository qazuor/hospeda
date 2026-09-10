import { SubscriptionStatusEnum } from '@repo/schemas';
import { BILLING_CRON_LAG_GRACE_HOURS } from '../constants/billing.constants.js';
import { normalizeStoredSubscriptionStatus } from './subscription-status-normalize.js';

/**
 * Input shape for `isSubscriptionLive`.
 *
 * All date fields are optional. When absent or `null`, the subscription is
 * treated as live (fail-open), matching the current behaviour of the
 * `checkEligibility` gate which does not inspect dates at all.
 */
export interface IsSubscriptionLiveInput {
    /**
     * Billing subscription status string (e.g. 'active', 'trialing', 'cancelled'),
     * in either the Hospeda or the qzpay vocabulary — it is normalized before any
     * branch is taken (HOS-1310).
     */
    readonly status: string;
    /**
     * Timestamp at which the trial period ends.
     * Only meaningful when `status === 'trialing'`.
     * `null` or `undefined` → treated as live (fail-open).
     */
    readonly trialEnd?: Date | null;
    /**
     * Timestamp at which the current billing period ends.
     * Meaningful when `status === 'active'` (cron-lag grace applies) or
     * `status === 'cancelled'` (paid-through grace: live until period end, no
     * extra grace — and only together with {@link cancelAtPeriodEnd}).
     * `null` or `undefined` → treated as live (fail-open).
     *
     * **Do not read this field as evidence of payment.** qzpay stamps it at
     * INSERT as `now + 30 days`, before any charge
     * (`packages/drizzle/src/adapter/drizzle-storage.adapter.ts`), so a row that
     * never completed a checkout carries a period end a month in the future.
     */
    readonly currentPeriodEnd?: Date | null;
    /**
     * Timestamp at which a gifted courtesy window ends (HOS-180).
     * Only meaningful when `status === 'courtesy'`.
     * `null` or `undefined` → treated as live (fail-open), consistent with
     * every other date on this input.
     */
    readonly courtesyEndsAt?: Date | null;
    /**
     * Whether the owner asked to stop at the end of a period they had already
     * paid for (`billing_subscriptions.cancel_at_period_end`).
     *
     * Only meaningful when `status === 'cancelled'`, and there it is REQUIRED to
     * be `true` for the paid-through grace to apply — see that branch and the
     * "a cancelled row is not evidence of payment" section of this module's
     * docblock.
     *
     * **This is the one field on this input that does NOT fail open**, and the
     * asymmetry is deliberate. Absent, `null` and `false` all mean the same
     * thing: no evidence this owner ever paid for the period the date claims.
     * Every other field here says WHEN something ends, where absence honestly
     * means "nothing to expire against"; this one says WHETHER anything was
     * bought, and guessing `true` is how a never-paid row reads as a paying
     * customer.
     */
    readonly cancelAtPeriodEnd?: boolean | null;
    /**
     * Current time as a Unix epoch in milliseconds.
     * Defaults to `Date.now()` at call time when omitted.
     * Always pass an explicit value in tests for determinism.
     */
    readonly nowMs?: number;
    /**
     * Cron-lag grace window in hours.
     * Defaults to `BILLING_CRON_LAG_GRACE_HOURS` (6 h) when omitted.
     * Applies only to `'active'` subscriptions; `'cancelled'` always uses 0 h grace
     * (access is valid exactly until `currentPeriodEnd`, not beyond).
     * The subscription is considered live while `(now - periodEnd) <= graceHours`.
     */
    readonly graceHours?: number;
}

/**
 * Determines whether a billing subscription is currently live (i.e. should
 * grant access to entitlements).
 *
 * Logic:
 * - `'comp'` (SPEC-262 complimentary): **always** live — a comped subscription
 *   is never charged and has no period/trial end to expire against (HOS-239).
 * - `'active'`: live iff `currentPeriodEnd` is absent/null **or** the period
 *   has not exceeded the cron-lag grace window (default 6 h).
 * - `'trialing'`: live iff `trialEnd` is absent/null **or** the trial has not
 *   exceeded the cron-lag grace window.
 * - `'cancelled'` (paid-through grace): live iff `cancelAtPeriodEnd === true`
 *   **and** (`currentPeriodEnd` is absent/null **or** `currentPeriodEnd > now`).
 *   No extra grace window applies; access is valid exactly until the period the
 *   owner already paid for ends. Commonly called the "soft-cancel" grace, which
 *   is misleading: an in-app soft cancel does NOT write this status (it writes
 *   `cancelAtPeriodEnd` and leaves the status alone — see
 *   `services/subscription-cancel.service.ts`). The rows that reach this branch
 *   mid-period come from the MercadoPago webhook (a provider `canceled`, mapped
 *   by `QZPAY_TO_HOSPEDA_STATUS`) and from qzpay-core's hard cancel.
 *   `finalize-cancelled-subs` only writes it once the effective end date has
 *   passed, so its rows answer `false` here on the date alone.
 *
 * ## A cancelled row is not evidence of payment (HOS-1310)
 *
 * The `cancelAtPeriodEnd` requirement above is the whole point of this section,
 * because the date it guards is a placeholder:
 *
 * 1. qzpay stamps `currentPeriodEnd = now + 30 days` in the INSERT, next to
 *    `status = 'incomplete'`, BEFORE the owner has authorized anything
 *    (`packages/drizzle/src/adapter/drizzle-storage.adapter.ts`).
 * 2. The owner abandons MercadoPago's page, or their card is refused.
 * 3. MercadoPago reports the preapproval cancelled. The webhook maps that to
 *    `CANCELLED` — a transition its own table documents as routine for the
 *    redirect checkout (`subscription-status-transitions.ts`) — and, on exactly
 *    the `pending_provider` → cancelled edge, it REWRITES `currentPeriodEnd`
 *    from `date_created + 1 month` rather than clearing it
 *    (`routes/webhooks/mercadopago/subscription-logic.ts`, and the adapter's
 *    `calculatePeriodEnd`). The phantom date is refreshed, not removed. The same
 *    path is reachable without a webhook through `subscription-poll.job.ts`.
 * 4. Nothing reaps that row: the abandoned-pending reaper only selects
 *    `incomplete`/`pending_provider`, and `finalize-cancelled-subs` only
 *    `active`/`past_due`/`trialing`. It ages out on its own, ~30 days later.
 *
 * On the date alone this predicate called that row live, so
 * `accommodation-publish-deps.ts`'s `checkEligibility` answered
 * `has_active_sub` — which both let the owner publish for a month without
 * paying AND short-circuited `resolveTrialEligibility`, costing them the local
 * trial they still had. `cancelAtPeriodEnd` is the one column that tells the two
 * populations apart, and it is not set on the phantom row.
 *
 * **Unverified, and it decides the size of the window, not the correctness of
 * this guard:** if MercadoPago omits `auto_recurring` on a cancelled
 * preapproval, `calculatePeriodEnd` returns its `startDate` unchanged, so
 * `currentPeriodEnd` lands in the past and the exposure was always zero. If MP
 * returns it, the window is 30 days. That cannot be measured without the real
 * provider — it is what a smoke of this change should look at.
 * - `'courtesy'` (HOS-180): live iff `courtesyEndsAt` is absent/null **or**
 *   the window has not exceeded the cron-lag grace, mirroring `'active'`.
 * - All other statuses (`past_due`, `paused`, `expired`, etc.) → `false`.
 *   `'paused'` staying false is what distinguishes a real pause from the
 *   courtesy sitting on top of one.
 * - A date that cannot be parsed (i.e. `isNaN(date.getTime())`) is treated as
 *   absent, preserving the fail-open policy.
 * - The grace window uses `<=` at the boundary: a subscription overdue by
 *   exactly `graceHours` is still considered live (cron-lag semantics).
 *
 * ## The status is normalized first (HOS-1310)
 *
 * `input.status` is read straight off `billing_subscriptions.status`, which holds
 * two vocabularies, so it goes through {@link normalizeStoredSubscriptionStatus}
 * before any branch is taken. The spelling that mattered is qzpay's American
 * `canceled` (1 L), which qzpay-core writes on a hard cancel while Hospeda's own
 * writers use the British `cancelled`: the `'cancelled'` branch below could not
 * see it, so such a row answered `false` no matter how far in the future
 * `currentPeriodEnd` sat. The repo already treats the two as one state — the
 * state machine normalizes them on read, and
 * `extras/035-canceled-spelling-normalize` folds the column on every deploy — so
 * the answer for such a row used to depend on whether a deploy had run since
 * qzpay wrote it. Normalizing here makes it depend on the row instead.
 *
 * @param input - Subscription fields required for the liveness check.
 * @returns `true` when the subscription grants access; `false` otherwise.
 *
 * @example
 * ```ts
 * // Active subscription inside the 6-hour cron-lag grace window
 * const oneHourAgo = Date.now() - 1 * 3_600_000;
 * isSubscriptionLive({
 *   status: 'active',
 *   currentPeriodEnd: new Date(oneHourAgo),
 * }); // true
 *
 * // Active subscription 7 hours past period end (outside grace)
 * const sevenHoursAgo = Date.now() - 7 * 3_600_000;
 * isSubscriptionLive({
 *   status: 'active',
 *   currentPeriodEnd: new Date(sevenHoursAgo),
 * }); // false
 *
 * // Cancelled subscription within soft-cancel grace (period_end still in future)
 * const futurePeriodEnd = new Date(Date.now() + 5 * 24 * 3_600_000);
 * isSubscriptionLive({
 *   status: 'cancelled',
 *   currentPeriodEnd: futurePeriodEnd,
 * }); // true
 *
 * // Cancelled subscription with period_end in the past → no access
 * const pastPeriodEnd = new Date(Date.now() - 1 * 3_600_000);
 * isSubscriptionLive({
 *   status: 'cancelled',
 *   currentPeriodEnd: pastPeriodEnd,
 * }); // false
 * ```
 */
export function isSubscriptionLive(input: IsSubscriptionLiveInput): boolean {
    const {
        status: rawStatus,
        trialEnd,
        currentPeriodEnd,
        courtesyEndsAt,
        cancelAtPeriodEnd,
        nowMs = Date.now(),
        graceHours = BILLING_CRON_LAG_GRACE_HOURS
    } = input;

    // HOS-1310: the column holds qzpay's vocabulary as well as Hospeda's. An
    // unknown status keeps the pre-normalization answer (it matched no branch
    // and fell through to `false`), so this narrows nothing.
    const status = normalizeStoredSubscriptionStatus(rawStatus);

    if (status === SubscriptionStatusEnum.COMP) {
        // HOS-239: a permanently-complimentary subscription (SPEC-262) grants its
        // plan's entitlements forever — it is never charged and has no period/trial
        // end to expire against, so it is unconditionally live. Aligns the
        // date-aware gate (publish eligibility via `checkEligibility`) with the
        // status-only entitlement finds (isEntitlementGrantingStatus), which
        // already treat comp as live; before this, a HOST comped on an owner plan
        // passed the entitlement middleware but was blocked from actually
        // publishing because checkEligibility filtered the comp sub out.
        return true;
    }

    if (status === SubscriptionStatusEnum.TRIALING) {
        const graceLimitMs = graceHours * 3_600_000;
        return isWithinGrace({ date: trialEnd, nowMs, graceLimitMs });
    }

    if (status === SubscriptionStatusEnum.ACTIVE) {
        const graceLimitMs = graceHours * 3_600_000;
        return isWithinGrace({ date: currentPeriodEnd, nowMs, graceLimitMs });
    }

    if (status === SubscriptionStatusEnum.CANCELLED) {
        // Paid-through grace: the owner paid through currentPeriodEnd — grant
        // access until that moment, but no extra cron-lag window beyond it.
        //
        // `cancelAtPeriodEnd === true` is REQUIRED, not decorative: it is the
        // only column that separates an owner who paid and then asked to stop
        // from a row that never completed a checkout at all. The date cannot,
        // because qzpay stamps `currentPeriodEnd = now + 30 days` at INSERT,
        // before any charge. See the module docblock.
        //
        // Reached by qzpay's American `canceled` too, since HOS-1310 normalizes
        // the input. Both halves are needed and neither is sufficient: without
        // normalization a legitimate soft-cancel that came through qzpay's
        // spelling is denied its paid period; without this flag a never-paid row
        // is granted one.
        if (cancelAtPeriodEnd !== true) {
            return false;
        }
        return isWithinGrace({ date: currentPeriodEnd, nowMs, graceLimitMs: 0 });
    }

    if (status === SubscriptionStatusEnum.COURTESY) {
        // HOS-180: gifted cycles grant the full plan. The cron-lag grace applies
        // for the same reason it does to 'active' — the job that resumes the
        // preapproval runs on a schedule, and cutting a subscriber off in the gap
        // between the window closing and the cron catching up would punish them
        // for our timing.
        const graceLimitMs = graceHours * 3_600_000;
        return isWithinGrace({ date: courtesyEndsAt, nowMs, graceLimitMs });
    }

    // All other statuses are not live: past_due, paused, expired,
    // pending_provider, abandoned — and, via normalization, qzpay's `unpaid`
    // (→ past_due), `incomplete` (→ pending_provider) and `incomplete_expired`
    // (→ abandoned). An unrecognized status arrives here as `null` and is
    // likewise not live.
    return false;
}

/**
 * Returns `true` when `date` is absent, invalid, in the future, or within
 * `graceLimitMs` milliseconds in the past relative to `nowMs`.
 */
function isWithinGrace(params: {
    readonly date: Date | null | undefined;
    readonly nowMs: number;
    readonly graceLimitMs: number;
}): boolean {
    const { date, nowMs, graceLimitMs } = params;

    if (date == null) {
        return true;
    }

    const dateMs = date.getTime();

    if (Number.isNaN(dateMs)) {
        // Invalid Date — fail open (cannot determine expiry)
        return true;
    }

    const overdueMs = nowMs - dateMs;
    return overdueMs <= graceLimitMs;
}
