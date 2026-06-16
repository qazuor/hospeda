/**
 * Subscription product-domain isolation utilities (SPEC-239 T-034).
 *
 * `billing_subscriptions.product_domain` is added via the extras carril
 * (a hand-written idempotent ALTER TABLE, NOT in the qzpay-drizzle TS schema).
 * The column defaults to `'accommodation'` and every legacy row predates it,
 * so it will be `null` / `undefined` on many in-flight objects.
 *
 * **Filtering contract (safety invariant)**
 * - `null` / `undefined` / `'accommodation'` → include (accommodation domain).
 * - `'commerce'` → exclude from accommodation-side reads.
 * - Any other unexpected value → include (fail-open; never silently drop a real
 *   accommodation sub due to an unexpected value).
 *
 * This makes the filter a strict **no-op on all existing data and tests** —
 * the column default means every real row is treated as accommodation until
 * a commerce subscription is explicitly created with `product_domain='commerce'`.
 *
 * @module services/billing/subscription/subscription-product-domain
 */

/** The only `product_domain` value that identifies a commerce subscription. */
const COMMERCE_DOMAIN = 'commerce' as const;

/**
 * Returns `true` when the subscription belongs to the accommodation domain.
 *
 * Reads `productDomain` defensively from an opaque runtime object because
 * the column is NOT in the `@qazuor/qzpay-core` TypeScript types — it is
 * added directly to the PostgreSQL table via the extras carril.  The value
 * is read by casting `sub` to `Record<string, unknown>` so that bracket
 * access avoids `any` and keeps strict-mode happy.
 *
 * **Inclusion rule**: include unless explicitly `'commerce'`.
 * - `undefined` (column not yet in SELECT) → include
 * - `null` (legacy row, column exists but value is NULL) → include
 * - `'accommodation'` (explicit default) → include
 * - `'commerce'` (new commerce sub) → **exclude**
 * - anything else (future domains) → include (fail-open)
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
    // Read BOTH casings: the column is added via the extras carril and is NOT in
    // the qzpay-drizzle TS schema, so depending on how the row is fetched it may
    // surface as the camelCase `productDomain` (if mapped) or the raw snake_case
    // `product_domain` (if selected via `*`). Reading both keeps the filter
    // effective regardless of the read path — critical so a commerce sub is never
    // silently treated as accommodation (the SPEC-239 isolation invariant).
    const productDomain = record.productDomain ?? record.product_domain;
    // Exclude ONLY when the value is explicitly 'commerce'.
    // null / undefined / 'accommodation' / any-other-value → include.
    return productDomain !== COMMERCE_DOMAIN;
}
