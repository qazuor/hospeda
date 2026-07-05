/**
 * Subscription product-domain isolation utilities (SPEC-239 T-034).
 *
 * `billing_subscriptions.product_domain` is a typed Drizzle column as of
 * `@qazuor/qzpay-drizzle` 1.11.0 (HOS-73). The column defaults to
 * `'accommodation'` and every legacy row predates it, so it will be `null` /
 * `undefined` on many in-flight objects.
 *
 * **Filtering contract (safety invariant)**
 * - `null` / `undefined` / `'accommodation'` → include (accommodation domain).
 * - `'commerce'` / `'partner'` → exclude from accommodation-side reads.
 * - Any other unexpected value → exclude (fail-closed; once additional domains
 *   exist, silently treating them as accommodation would contaminate host
 *   entitlements).
 *
 * This makes the filter a strict **no-op on all existing data and tests** —
 * the column default means every real row is treated as accommodation until
 * a commerce subscription is explicitly created with `product_domain='commerce'`.
 *
 * @module services/billing/subscription/subscription-product-domain
 */

import { billingSubscriptions, type DrizzleClient, eq, getDb } from '@repo/db';

/**
 * Discount-relevant state for a single subscription, as loaded by
 * {@link loadSubscriptionDiscountState}.
 */
export interface SubscriptionDiscountState {
    id: string;
    status: string;
    planId: string;
    customerId: string;
    mpSubscriptionId: string | null;
    promoCodeId: string | null;
    promoEffectRemainingCycles: number | null;
}

/**
 * Returns `true` when the subscription belongs to the accommodation domain.
 *
 * Reads `productDomain` from an opaque runtime object, cast to
 * `Record<string, unknown>` so that bracket access avoids `any` and keeps
 * strict-mode happy. As of `@qazuor/qzpay-drizzle` 1.11.0 (HOS-73) this is a
 * typed Drizzle column, so every caller that fetches a subscription via a
 * typed query gets `productDomain` (camelCase) populated directly — no
 * snake_case fallback is needed (removed in HOS-75 T-003).
 *
 * **Inclusion rule**: include only when the row is clearly accommodation.
 * - `undefined` (column not yet in SELECT) → include
 * - `null` (legacy row, column exists but value is NULL) → include
 * - `'accommodation'` (explicit default) → include
 * - `'commerce'` / `'partner'` → **exclude**
 * - anything else (future domains) → exclude (fail-closed)
 *
 * @param sub - Any object returned by `billing.subscriptions.getByCustomerId()`.
 * @returns `true` when the subscription should be visible to the accommodation engine.
 *
 * @example
 * ```ts
 * const activeAccommodationSub = subscriptions.find(
 *   (sub) =>
 *     (sub.status === 'active' || sub.status === 'trialing') &&
 *     isAccommodationSubscription(sub)
 * );
 * ```
 */
export function isAccommodationSubscription(sub: unknown): boolean {
    // Guard: non-object values (null, undefined, primitives) have no productDomain.
    // Treat them as accommodation (fail-open: never silently drop a real sub).
    if (sub === null || sub === undefined || typeof sub !== 'object') {
        return true;
    }
    const record = sub as Record<string, unknown>;
    const productDomain = record.productDomain;
    // Include legacy rows (null / undefined) and explicit accommodation rows.
    if (
        productDomain === null ||
        productDomain === undefined ||
        productDomain === 'accommodation'
    ) {
        return true;
    }

    return false;
}

/**
 * Loads a subscription's discount-relevant state via a single typed Drizzle
 * query. Replaces 4 near-identical raw-SQL `SELECT`s that were copy-pasted
 * across `payment-logic.ts`, `dunning.job.ts`, `apply-scheduled-plan-changes.ts`,
 * and `promo-code.renewal.ts` (HOS-75) — each caller destructures only the
 * fields it needs.
 *
 * @param input.subscriptionId - The subscription's id.
 * @param input.tx - Optional Drizzle client (e.g. a caller-provided
 *   transaction) so the read participates in the caller's boundary. Defaults
 *   to a standalone `getDb()` connection.
 * @returns The subscription's discount state, or `null` when no row matches.
 */
export async function loadSubscriptionDiscountState(input: {
    subscriptionId: string;
    tx?: DrizzleClient;
}): Promise<SubscriptionDiscountState | null> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            planId: billingSubscriptions.planId,
            customerId: billingSubscriptions.customerId,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
            promoCodeId: billingSubscriptions.promoCodeId,
            promoEffectRemainingCycles: billingSubscriptions.promoEffectRemainingCycles
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, input.subscriptionId))
        .limit(1);

    return row ?? null;
}
