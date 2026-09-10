import { ENTITLEMENT_GRANTING_STATUSES } from './is-entitlement-granting-status.js';
import { normalizeStoredSubscriptionStatus } from './subscription-status-normalize.js';

/**
 * Subscription statuses under which the customer still has a REAL, unfinished
 * relationship with the payment provider — a wider set than
 * {@link ENTITLEMENT_GRANTING_STATUSES}.
 *
 * Built by SPREADING the canonical entitlement-granting set and adding
 * `past_due` on top, never as a hand-rolled list. That is the point, not a
 * style preference: HOS-702 found a hand-rolled copy that omitted `comp`, so an
 * owner whose listing already carried a complimentary subscription could start
 * a second, real, CHARGED checkout for it. A status added to the canonical set
 * is picked up here automatically.
 *
 * ## Why `past_due` belongs here but NOT in the entitlement-granting set
 *
 * The two sets answer different questions:
 *
 * - `ENTITLEMENT_GRANTING_STATUSES` answers **"does this subscription grant its
 *   plan's capabilities right now?"** — a past-due subscription does not, which
 *   is why dunning exists.
 * - This set answers **"is this subscription still a live thing that must not be
 *   duplicated, and whose owner must not be treated as having walked away?"** —
 *   a past-due subscription IS: it is a real MercadoPago preapproval mid-retry,
 *   inside a 7-day dunning grace window, and the correct path back to `active`
 *   is that flow, not a fresh start.
 *
 * ## `past_due` is handled downstream, not here (HOS-1275)
 *
 * Consumers of this set do NOT need to decide whether a past-due customer is
 * still inside their grace window: `pastDueGraceMiddleware`
 * (`apps/api/src/middlewares/past-due-grace.middleware.ts`, mounted on
 * `/api/v1/protected/*`) already answers **402 `GRACE_PERIOD_EXPIRED`** once the
 * 7-day window elapses, and has been scoped per product domain since HOS-1277.
 * A second copy of that arithmetic sitting inside an unrelated gate would be a
 * decision made twice, in two places, that can disagree.
 *
 * ## Known: `past_due` is unreachable in production today (HOS-1302)
 *
 * No writer in this repo puts `past_due` into `billing_subscriptions.status`
 * (`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` says so
 * inline; this repo's own dunning status mutations are off —
 * `DUNNING_MUTATIONS_ENABLED = false` in `cron/jobs/dunning.job.ts`). The
 * status is MAPPED on read by `subscription-status-provider.ts` /
 * `subscription-status-normalize.ts`; the missing half is the write. Membership
 * here is therefore design, not live population — and it must stay, because the
 * day the write is re-enabled is not the day anyone will remember to add it.
 *
 * ## `unpaid` is `past_due` wearing qzpay's spelling (HOS-1310)
 *
 * The set is Hospeda vocabulary, but the column it is compared against also
 * holds qzpay's. `unpaid` is qzpay's name for the same state
 * (`subscription-status-normalize.ts` maps it to `PAST_DUE`, and Hospeda models
 * no separate unpaid state), so before the normalization below
 * `isLiveSubscriptionStatus('unpaid')` was `false` while
 * `isLiveSubscriptionStatus('past_due')` was `true` — one state, two answers,
 * which is the HOS-108 mechanism. The membership of `past_due` above is the
 * whole design of this set, so losing it to a spelling defeated the module.
 *
 * ## What is deliberately OUT
 *
 * `cancelled`, `expired`, `abandoned` and `paused`. Those are terminal or
 * inactive enough that starting over is the correct next step.
 *
 * A SOFT-cancel is not among them, and the reason is NOT that this set covers
 * it: `softCancelSubscription` (`apps/api/src/services/subscription-cancel.service.ts`)
 * writes only `cancelAtPeriodEnd = true` and leaves `status` untouched, and
 * qzpay-core's `subscriptions.cancel()` writes `status` only when
 * `cancelAtPeriodEnd` is falsy (`packages/core/src/billing.ts` — verified
 * against the source, 2026-09-10). So a soft-cancelled row keeps whatever
 * status it had (`active`/`trialing`/`courtesy`) and is matched by THAT entry,
 * not by a cancelled one. The distinction matters because callers must not read
 * membership here as "a soft-cancel is live": a soft-cancel is live because its
 * status never changed, and `cancelAtPeriodEnd` is a separate flag that
 * `start-paid.ts` checks on its own for exactly that reason.
 */
export const LIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set<string>([
    ...ENTITLEMENT_GRANTING_STATUSES,
    'past_due'
]);

/**
 * Whether a subscription status means the customer still has an unfinished
 * relationship with the payment provider. See {@link LIVE_SUBSCRIPTION_STATUSES}.
 *
 * This is NOT the same question as "does it grant entitlements" — use
 * {@link import('./is-entitlement-granting-status.js').isEntitlementGrantingStatus}
 * for that, and read this module's docblock for why the two differ on `past_due`.
 *
 * @param status - The billing subscription status string, in either the Hospeda
 *   or the qzpay vocabulary. qzpay's `unpaid` is accepted as `past_due`; see the
 *   set's docblock.
 * @returns `true` for `'active'`, `'trialing'`, `'comp'`, `'courtesy'`,
 *   `'past_due'` or `'unpaid'`; `false` otherwise.
 *
 * @example
 * ```ts
 * // Refuse a second checkout while the first one is still resolvable.
 * if (existingStatus !== null && isLiveSubscriptionStatus(existingStatus)) {
 *   throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, '...');
 * }
 * ```
 */
export function isLiveSubscriptionStatus(status: string): boolean {
    const normalized = normalizeStoredSubscriptionStatus(status);
    if (normalized === null) {
        return false;
    }
    return LIVE_SUBSCRIPTION_STATUSES.has(normalized);
}
