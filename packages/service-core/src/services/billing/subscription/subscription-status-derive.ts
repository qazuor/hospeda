/**
 * Subscription Status Derivation (card-first trial — HOS-171)
 *
 * Single source of truth for deriving the local `TRIALING` status from a
 * provider-reported status plus the local trial window.
 *
 * ## Why this exists
 *
 * Under the card-first design the trial is MercadoPago's
 * `auto_recurring.free_trial`: the payer authorizes a card on day 1 and MP
 * defers the first charge to day N. MercadoPago has no concept of a "trial"
 * status — it reports the preapproval as `authorized`, which qzpay maps to
 * `active`. Hospeda still needs to know "this subscription is inside its free
 * window" because entitlement gates, the trial middleware and the admin UI all
 * key off {@link SubscriptionStatusEnum.TRIALING}.
 *
 * So `TRIALING` is **derived**, not stored at creation time. The provider says
 * `active`; the local `trialEnd` says whether that `active` is a trial or a
 * paying subscription.
 *
 * ## Why NOT derive it at creation time
 *
 * qzpay deliberately inserts `mode: 'paid'` rows as `incomplete`
 * (`drizzle-storage.adapter.ts`), because the local row is written BEFORE the
 * provider call and the payer has not authorized anything yet. Marking such a
 * row `trialing` at insert time would grant N days of entitlements to anyone who
 * abandons MercadoPago's authorization page — a real entitlement-leak bug. That
 * guard is load-bearing: do not "fix" it. Deriving here, after the provider
 * confirms authorization, is the design its own comment prescribes.
 *
 * @module services/subscription-status-derive
 */

import { SubscriptionStatusEnum } from '@repo/schemas';

/**
 * Input for {@link deriveTrialingStatus}.
 */
export interface DeriveTrialingStatusInput {
    /**
     * The status already mapped from the provider's vocabulary into Hospeda's
     * (i.e. the output of the webhook's `QZPAY_TO_HOSPEDA_STATUS` lookup).
     */
    readonly mappedStatus: SubscriptionStatusEnum;
    /**
     * The local `billing_subscriptions.trial_end`. `null` when the subscription
     * carries no trial. qzpay writes this on `mode: 'paid'` regardless of
     * whether the row is `incomplete`, so it is populated before authorization.
     *
     * `undefined` is accepted and treated exactly like `null`. This helper sits
     * on the webhook's hot path, where throwing would dead-letter the event and
     * leave the subscription permanently unactivated — far too high a price for
     * a nullish distinction that carries no meaning here. Absent and null both
     * mean "no known trial window", so neither derives a trial.
     */
    readonly trialEnd: Date | null | undefined;
    /** Injected clock, so the derivation is deterministic under test. */
    readonly now: Date;
}

/**
 * Derives {@link SubscriptionStatusEnum.TRIALING} from a provider-reported
 * `ACTIVE` plus a local trial window that has not yet elapsed.
 *
 * Pure and I/O-free — the caller supplies the already-fetched `trialEnd` and the
 * clock, so this costs zero extra queries.
 *
 * The full truth table:
 *
 * | `mappedStatus` | `trialEnd`      | Result       | Why |
 * | -------------- | --------------- | ------------ | --- |
 * | `ACTIVE`       | in the future   | **`TRIALING`** | MP authorized, first charge deferred |
 * | `ACTIVE`       | `null`          | `ACTIVE`     | Ordinary paid subscription, no trial |
 * | `ACTIVE`       | in the past     | `ACTIVE`     | Trial elapsed; MP has charged. Correct end state |
 * | anything else  | any             | unchanged    | Never derive off a non-active status |
 *
 * The last row is the important one: deriving `TRIALING` from `paused`,
 * `cancelled`, `past_due` or `expired` would resurrect a dead subscription into
 * a live status purely because its trial window happens to still be open.
 *
 * @param input - The mapped provider status, the local trial end, and the clock.
 * @returns `TRIALING` when the subscription is inside an authorized trial window;
 *   otherwise `mappedStatus` unchanged.
 *
 * @example
 * ```ts
 * // Provider authorized a 14-day card-first trial → local row becomes trialing
 * deriveTrialingStatus({
 *   mappedStatus: SubscriptionStatusEnum.ACTIVE,
 *   trialEnd: new Date('2026-08-01'),
 *   now: new Date('2026-07-18'),
 * }); // => SubscriptionStatusEnum.TRIALING
 *
 * // Trial elapsed and MP charged → the row is genuinely active
 * deriveTrialingStatus({
 *   mappedStatus: SubscriptionStatusEnum.ACTIVE,
 *   trialEnd: new Date('2026-07-01'),
 *   now: new Date('2026-07-18'),
 * }); // => SubscriptionStatusEnum.ACTIVE
 *
 * // A cancelled subscription stays cancelled, open trial window or not
 * deriveTrialingStatus({
 *   mappedStatus: SubscriptionStatusEnum.CANCELLED,
 *   trialEnd: new Date('2026-08-01'),
 *   now: new Date('2026-07-18'),
 * }); // => SubscriptionStatusEnum.CANCELLED
 * ```
 */
export function deriveTrialingStatus(input: DeriveTrialingStatusInput): SubscriptionStatusEnum {
    const { mappedStatus, trialEnd, now } = input;

    if (mappedStatus !== SubscriptionStatusEnum.ACTIVE) {
        return mappedStatus;
    }

    if (trialEnd === null || trialEnd === undefined) {
        return mappedStatus;
    }

    return trialEnd.getTime() > now.getTime() ? SubscriptionStatusEnum.TRIALING : mappedStatus;
}

/**
 * Input for {@link deriveCourtesyStatus}.
 */
export interface DeriveCourtesyStatusInput {
    /**
     * The status already mapped from the provider's vocabulary into Hospeda's.
     * For a courtesy this is `PAUSED`, because pausing the preapproval is the
     * mechanism that makes MercadoPago skip the gifted cycles.
     */
    readonly mappedStatus: SubscriptionStatusEnum;
    /**
     * End of the local courtesy window. `null`/`undefined` means the
     * subscription was never gifted anything — same nullish tolerance and same
     * reason as {@link DeriveTrialingStatusInput.trialEnd}: this runs on the
     * webhook hot path, where throwing would dead-letter the event.
     */
    readonly courtesyEndsAt: Date | null | undefined;
    /** Injected clock, so the derivation is deterministic under test. */
    readonly now: Date;
}

/**
 * Derives {@link SubscriptionStatusEnum.COURTESY} from a provider-reported
 * `PAUSED` plus a local courtesy window that has not yet elapsed (HOS-180).
 *
 * The exact mirror of {@link deriveTrialingStatus}, one status over: MercadoPago
 * has no vocabulary for "this month is on us" any more than it has one for
 * "trial", so both are local readings of a provider state. Pure and I/O-free.
 *
 * | `mappedStatus` | `courtesyEndsAt` | Result | Why |
 * | -------------- | ---------------- | ------ | --- |
 * | `PAUSED`       | in the future    | **`COURTESY`** | Inside the gift; entitlements stay on |
 * | `PAUSED`       | `null`           | `PAUSED` | A real pause; entitlements are cut |
 * | `PAUSED`       | in the past      | `PAUSED` | The gift lapsed. The cron is resuming it |
 * | anything else  | any              | unchanged | Never derive off a non-paused status |
 *
 * Two rows carry the weight. The second is the whole point: **one provider state,
 * two local readings.** `paused` means "paused" or "courtesy" depending solely on
 * this column, and a real pause must keep cutting entitlements. The last row stops
 * a cancelled or expired subscription being resurrected into a live status by a
 * courtesy column nobody cleared.
 *
 * The boundary is exclusive (`>` not `>=`): at the exact instant the window
 * closes the gift is over. Deriving `COURTESY` there would keep the subscriber
 * one tick past their gift and race the cron resuming the preapproval.
 *
 * Order relative to {@link deriveTrialingStatus} does not matter — trialing keys
 * off `ACTIVE`, courtesy off `PAUSED`, so they can never both fire on one input.
 * That independence is asserted by a test rather than left to inspection.
 *
 * @param input - The mapped provider status, the local courtesy end, and the clock.
 * @returns `COURTESY` when the subscription is inside a live courtesy window;
 *   otherwise `mappedStatus` unchanged.
 *
 * @example
 * ```ts
 * // Admin gifted two cycles; MP reports the preapproval paused
 * deriveCourtesyStatus({
 *   mappedStatus: SubscriptionStatusEnum.PAUSED,
 *   courtesyEndsAt: new Date('2026-11-01'),
 *   now: new Date('2026-09-15'),
 * }); // => SubscriptionStatusEnum.COURTESY
 *
 * // Someone paused their own subscription — not a gift, entitlements cut
 * deriveCourtesyStatus({
 *   mappedStatus: SubscriptionStatusEnum.PAUSED,
 *   courtesyEndsAt: null,
 *   now: new Date('2026-09-15'),
 * }); // => SubscriptionStatusEnum.PAUSED
 * ```
 */
export function deriveCourtesyStatus(input: DeriveCourtesyStatusInput): SubscriptionStatusEnum {
    const { mappedStatus, courtesyEndsAt, now } = input;

    if (mappedStatus !== SubscriptionStatusEnum.PAUSED) {
        return mappedStatus;
    }

    if (courtesyEndsAt === null || courtesyEndsAt === undefined) {
        return mappedStatus;
    }

    return courtesyEndsAt.getTime() > now.getTime()
        ? SubscriptionStatusEnum.COURTESY
        : mappedStatus;
}
