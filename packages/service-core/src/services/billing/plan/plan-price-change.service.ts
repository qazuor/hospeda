/**
 * Plan price-change propagation — enqueue seam (HOS-176).
 *
 * When an admin edits a plan's price, `updatePlan` writes the new amount locally
 * but MercadoPago keeps charging existing subscribers the OLD `transaction_amount`.
 * This module records a `billing_plan_price_changes` header row (in the SAME
 * transaction as the price write, so "price changed" ⟺ "propagation enqueued" is
 * atomic). The actual per-subscriber MP mutation is done LATER by the propagation
 * cron, which enumerates the CURRENT active subscribers at `effectiveAt` — never
 * a synchronous fan-out inside the admin request (there can be N subscribers).
 *
 * Layer separation (spike §5): service-core DECIDES (enqueue + direction + timing);
 * the API layer EXECUTES the MP mutation. No MercadoPago call happens here.
 *
 * Direction is asymmetric:
 *   - `decrease` — frictionless, no legal notice; `effectiveAt = now`.
 *   - `increase` — Disposición 954/2025 requires PRIOR notice + a grace window;
 *     `effectiveAt = now + grace`, and the notice is sent before the mutation. The
 *     increase mutation itself (raising `transaction_amount` above the originally
 *     authorized amount) is gated on the owner's MP sandbox smoke (spike G-1).
 *
 * @module services/billing/plan/plan-price-change
 */

import {
    and,
    billingPlanPriceChanges,
    billingSubscriptions,
    count,
    type DrizzleClient,
    eq,
    inArray,
    isNotNull
} from '@repo/db';

/**
 * Grace window (days) between the advance notice and applying a price INCREASE.
 *
 * ⚠️ PLACEHOLDER pending owner decision D-3 (spike §7): the legal notice window
 * length and copy sign-off (Disposición 954/2025) are an owner/legal call, not an
 * engineering default. 15 days is a conservative interim value; do NOT ship an
 * increase propagation without confirming this with the owner.
 */
export const PRICE_INCREASE_NOTICE_GRACE_DAYS = 15;

/**
 * Subscription statuses considered "affected" by a plan price change — the live,
 * chargeable subscribers whose preapproval the propagation will re-price. Mirrors
 * the billing "live sub" predicate family; `comp` is excluded (no preapproval).
 */
const AFFECTED_SUB_STATUSES = ['active', 'trialing', 'past_due'] as const;

/** `increase` when the new amount is higher than the old, else `decrease`. */
export type PriceChangeDirection = 'increase' | 'decrease';

/**
 * Pure: classify a price delta. Callers only enqueue when `newAmount !== oldAmount`
 * (a no-op write must not create a propagation row), so equality is treated as a
 * decrease here but guarded at the call site.
 *
 * @param input.oldAmount - Previous amount in integer centavos.
 * @param input.newAmount - New amount in integer centavos.
 * @returns `increase` if the price went up, otherwise `decrease`.
 */
export function resolvePriceChangeDirection(input: {
    readonly oldAmount: number;
    readonly newAmount: number;
}): PriceChangeDirection {
    return input.newAmount > input.oldAmount ? 'increase' : 'decrease';
}

/**
 * Pure: compute when the propagation may be applied.
 * - Decrease → immediately (`now`), no legal friction.
 * - Increase → `now + graceDays` (advance-notice window, Disp. 954/2025).
 *
 * @param input.direction - The price-change direction.
 * @param input.now - Reference "now" (injected for deterministic tests).
 * @param input.graceDays - Grace window in days for increases.
 * @returns The `effectiveAt` timestamp.
 */
export function computeEffectiveAt(input: {
    readonly direction: PriceChangeDirection;
    readonly now: Date;
    readonly graceDays: number;
}): Date {
    if (input.direction === 'decrease') {
        return new Date(input.now.getTime());
    }
    return new Date(input.now.getTime() + input.graceDays * 24 * 60 * 60 * 1000);
}

/**
 * Result of enqueuing a plan price change.
 */
export interface EnqueuePlanPriceChangeResult {
    /** The created `billing_plan_price_changes` row id. */
    readonly priceChangeId: string;
    /** Direction of the change. */
    readonly direction: PriceChangeDirection;
    /** When the propagation may be applied (`now` for decrease, `now + grace` for increase). */
    readonly effectiveAt: Date;
    /** Count of live subscribers (with an MP preapproval) on this plan+interval — the
     *  approximate blast radius for the admin confirmation copy (interval-scoped, so a
     *  monthly change is not inflated by annual subscribers). The propagation cron
     *  re-enumerates the exact set at `effectiveAt`. */
    readonly affectedSubscriberCount: number;
}

/**
 * Count live subscribers on a plan+interval that carry an MP preapproval — the set the
 * propagation will re-price for THIS interval's price change. Interval-scoped so the admin
 * confirmation ("affects N subscribers") is not inflated by subscribers on the plan's OTHER
 * interval (a monthly price change does not re-price annual subscribers, and vice-versa —
 * the cron matches `billing_interval` at apply time, HOS-176). Still an approximation of the
 * exact apply-time set (an increase further excludes trialing subs — D-4).
 *
 * `billing_subscriptions.billing_interval` stores `'month'`/`'year'` (the storage values —
 * `'monthly'`/`'annual'` are API labels only, per CLAUDE.md), matching the enqueued
 * `billingInterval`. This predicate mirrors the cron's `findAffectedSubscribers` exactly, so
 * a subscriber with a NULL `billing_interval` is excluded from BOTH the count and the cron's
 * re-price set — consistent by construction, not a drift.
 *
 * @param db - Drizzle client (transaction or root).
 * @param planId - The plan UUID (`billing_subscriptions.plan_id` stores it as varchar).
 * @param billingInterval - The interval whose price changed (`month` | `year`).
 * @returns Number of affected live subscribers on that plan+interval.
 */
async function countAffectedSubscribers(
    db: DrizzleClient,
    planId: string,
    billingInterval: 'month' | 'year'
): Promise<number> {
    const [row] = await db
        .select({ n: count() })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.planId, planId),
                eq(billingSubscriptions.billingInterval, billingInterval),
                inArray(billingSubscriptions.status, [...AFFECTED_SUB_STATUSES]),
                isNotNull(billingSubscriptions.mpSubscriptionId)
            )
        );
    return row?.n ?? 0;
}

/**
 * Enqueue a plan price-change propagation header row.
 *
 * MUST be called inside the same transaction as the `billing_prices` write, so the
 * price change and its propagation record commit atomically. Does NOT enumerate
 * per-subscriber targets or call MercadoPago — the cron does that at `effectiveAt`.
 *
 * @param input.db - Drizzle client (the caller's transaction).
 * @param input.planId - Plan UUID whose price changed.
 * @param input.priceId - The `billing_prices` row id that changed.
 * @param input.billingInterval - Which interval changed: `month` | `year`.
 * @param input.oldAmount - Previous amount, integer centavos.
 * @param input.newAmount - New amount, integer centavos.
 * @param input.actorId - Admin actor id (audit), or null.
 * @param input.now - Reference "now" (injected for tests; defaults to `new Date()`).
 * @param input.graceDays - Increase grace window (defaults to {@link PRICE_INCREASE_NOTICE_GRACE_DAYS}).
 * @returns The enqueued change id, direction, effectiveAt, and affected-subscriber count.
 */
export async function enqueuePlanPriceChange(input: {
    readonly db: DrizzleClient;
    readonly planId: string;
    readonly priceId: string;
    readonly billingInterval: 'month' | 'year';
    readonly oldAmount: number;
    readonly newAmount: number;
    readonly actorId?: string | null;
    readonly now?: Date;
    readonly graceDays?: number;
}): Promise<EnqueuePlanPriceChangeResult> {
    const {
        db,
        planId,
        priceId,
        billingInterval,
        oldAmount,
        newAmount,
        actorId = null,
        now = new Date(),
        graceDays = PRICE_INCREASE_NOTICE_GRACE_DAYS
    } = input;

    const direction = resolvePriceChangeDirection({ oldAmount, newAmount });
    const effectiveAt = computeEffectiveAt({ direction, now, graceDays });

    // Supersede any prior still-open change for the SAME plan+interval before
    // inserting: the newest price change is authoritative, so an older still-open
    // change (any direction) must not later re-apply its now-stale amount (W2). Runs
    // in the caller's transaction (same `db`), so it commits atomically with the insert.
    await db
        .update(billingPlanPriceChanges)
        .set({ status: 'superseded', updatedAt: new Date() })
        .where(
            and(
                eq(billingPlanPriceChanges.planId, planId),
                eq(billingPlanPriceChanges.billingInterval, billingInterval),
                inArray(billingPlanPriceChanges.status, ['pending', 'applying'])
            )
        );

    const [inserted] = await db
        .insert(billingPlanPriceChanges)
        .values({
            planId,
            priceId,
            billingInterval,
            oldAmount,
            newAmount,
            direction,
            status: 'pending',
            effectiveAt,
            actorId
        })
        .returning({ id: billingPlanPriceChanges.id });

    if (!inserted) {
        throw new Error('Failed to enqueue plan price change');
    }

    const affectedSubscriberCount = await countAffectedSubscribers(db, planId, billingInterval);

    return { priceChangeId: inserted.id, direction, effectiveAt, affectedSubscriberCount };
}
