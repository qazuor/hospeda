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
 * - any commerce vertical / `'partner'` → exclude from accommodation-side reads.
 * - Any other unexpected value → exclude (fail-closed; once additional domains
 *   exist, silently treating them as accommodation would contaminate host
 *   entitlements).
 *
 * This makes the filter a strict **no-op on all existing data and tests** —
 * the column default means every real row is treated as accommodation until
 * a commerce subscription is explicitly created in a commerce vertical.
 *
 * **One function decides (HOS-685)**: {@link subscriptionMatchesDomain} is the
 * only place in the codebase that compares a subscription's `productDomain`
 * against a value. Everything else — the two exported predicates below and the
 * two dispatch sites in `apps/api` — goes through it. This is not tidiness:
 * billing has twice grown a canonical helper and left call sites behind
 * (`normalizeStoredSubscriptionStatus`, `isEntitlementGrantingStatus`), which
 * is how two endpoints ended up disagreeing about the same subscription.
 * `scripts/check-product-domain-vocabulary.sh` fails CI on a new call site that
 * compares the domain itself.
 *
 * @module services/billing/subscription/subscription-product-domain
 */

import {
    and,
    billingPlans,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    isNull,
    sql
} from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';

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
    return subscriptionMatchesDomain(sub, ProductDomainEnum.ACCOMMODATION);
}

/**
 * Returns `true` when a subscription belongs to `domain`. The single place in
 * the codebase that compares a subscription's `productDomain` against a value.
 *
 * Two reading rules, both of them the vocabulary's own legacy semantics rather
 * than product behaviour (§6.8 G-2 forbids branching *behaviour* by domain; a
 * lookup that reads a different value is explicitly not that):
 *
 * - **`accommodation` fails open.** A missing object, or a row whose
 *   `productDomain` is `null`/`undefined`, counts as accommodation. The column
 *   post-dates most rows and defaults to `'accommodation'`, so a legacy row
 *   must not be dropped from a host's own entitlement set.
 * - **Every other domain matches its own string exactly**, fail-closed. In
 *   particular a row still carrying the retired `'commerce'` string (it
 *   should not, past release B / HOS-692) does NOT satisfy `'gastronomy'` or
 *   `'experience'` — HOS-695 narrowed this on purpose, so a stray legacy row
 *   goes dark instead of silently matching a vertical it was never resolved
 *   to.
 *
 * Fail-closed everywhere except accommodation means the failure mode of an
 * unrecognised value is **a dark listing, never a granted entitlement** — the
 * isolation SPEC-239 exists to guarantee.
 *
 * @param sub - Any object returned by `billing.subscriptions.getByCustomerId()`.
 * @param domain - The domain to test membership of.
 * @returns `true` when the subscription belongs to `domain`.
 *
 * @example
 * ```ts
 * const sub = subscriptions.find(
 *   (s) => isEntitlementGrantingStatus(s.status) && subscriptionMatchesDomain(s, domain)
 * );
 * ```
 */
export function subscriptionMatchesDomain(sub: unknown, domain: ProductDomainValue): boolean {
    const wantsAccommodation = domain === ProductDomainEnum.ACCOMMODATION;

    // Non-object values (null, undefined, primitives) have no productDomain.
    if (sub === null || sub === undefined || typeof sub !== 'object') {
        return wantsAccommodation;
    }

    const value = (sub as Record<string, unknown>).productDomain;

    // Legacy rows: the column post-dates them, so an absent value is accommodation.
    if (value === null || value === undefined) {
        return wantsAccommodation;
    }

    if (typeof value !== 'string') {
        return false;
    }

    return value === domain;
}

/**
 * Hydrates `productDomain` onto a list of subscriptions fetched via
 * `billing.subscriptions.getByCustomerId()`, before any of them reach
 * {@link subscriptionMatchesDomain} (HOS-934).
 *
 * **Why this exists**: `getByCustomerId()` returns
 * `QZPaySubscriptionWithHelpers` objects built by qzpay-core's mapper
 * field-by-field from the fields `QZPaySubscription` itself declares — there
 * is no spread of the underlying row, so a column qzpay-drizzle adds beyond
 * core's interface never reaches the object. `productDomain` is exactly such
 * a column (like `courtesyStartsAt`/`courtesyEndsAt`, see
 * `readCourtesyFields`'s module doc for the same mechanism), so every one of
 * these objects arrives with `productDomain` `undefined` — never `null`,
 * never the real string. Handed straight to `subscriptionMatchesDomain`,
 * that `undefined` reads as "legacy row, fail open to accommodation" for
 * EVERY subscription regardless of its real vertical: a gastronomy-only
 * subscription would match a caller scoped to `accommodation` and vanish
 * from a caller scoped to `gastronomy`/`experience`. This function closes
 * that gap once, centrally, so every caller that resolves "the" subscription
 * for a domain reads the same, correct value.
 *
 * A single batched `SELECT` recovers the column for every subscription that
 * is missing it. Subscriptions that already carry a `productDomain` (e.g. a
 * caller that hydrated already, or a future qzpay-core release that includes
 * the column) are left untouched — an explicit value, even `null`, is a real
 * answer and not a gap to fill.
 *
 * Returns NEW subscription objects (does not mutate the input array or its
 * elements) — `QZPaySubscriptionWithHelpers` instances are plain object
 * literals with their helper methods as own properties (not on a
 * prototype), so `{ ...sub, productDomain }` preserves every method
 * unchanged.
 *
 * @param subscriptions - Subscriptions as returned by `getByCustomerId()`.
 * @param tx - Optional Drizzle client (e.g. a caller-provided transaction) so
 *   the read participates in the caller's boundary. Defaults to a standalone
 *   `getDb()` connection.
 * @returns A new array, same order, each element carrying a real
 *   `productDomain` value (the stored string, or `null` for a legacy row
 *   whose column is genuinely `NULL`).
 *
 * @example
 * ```ts
 * const rawSubscriptions = await billing.subscriptions.getByCustomerId(customer.id);
 * const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions);
 * const match = subscriptions.find(
 *   (sub) => isEntitlementGrantingStatus(sub.status) && subscriptionMatchesDomain(sub, domain)
 * );
 * ```
 */
export async function hydrateSubscriptionProductDomains<T extends { id: string }>(
    subscriptions: readonly T[],
    tx?: DrizzleClient
): Promise<(T & { productDomain: string | null })[]> {
    if (subscriptions.length === 0) {
        return [];
    }

    const idsNeedingHydration = subscriptions
        .filter((sub) => (sub as Record<string, unknown>).productDomain === undefined)
        .map((sub) => sub.id);

    let domainById = new Map<string, string | null>();

    if (idsNeedingHydration.length > 0) {
        const db = tx ?? getDb();
        const rows = await db
            .select({
                id: billingSubscriptions.id,
                productDomain: billingSubscriptions.productDomain
            })
            .from(billingSubscriptions)
            .where(inArray(billingSubscriptions.id, idsNeedingHydration));

        domainById = new Map(rows.map((row) => [row.id, row.productDomain ?? null]));
    }

    return subscriptions.map((sub) => {
        const existing = (sub as Record<string, unknown>).productDomain;
        if (existing !== undefined) {
            return sub as T & { productDomain: string | null };
        }
        return {
            ...sub,
            productDomain: domainById.get(sub.id) ?? null
        };
    });
}

/**
 * Returns `true` when the subscription's plan belongs to the `'owner'` or
 * `'complex'` billing-plan category (HOS-217).
 *
 * **Why this exists**: `isAccommodationSubscription` only tells apart the
 * accommodation vs. commerce/partner *product domain* — it does NOT tell
 * apart an actual host plan from a tourist-tier plan (e.g. `tourist-vip`)
 * that also lives in the accommodation domain. A user can reach `role=HOST`
 * without ever subscribing to an owner plan (auto-promoted by
 * `AccommodationService.createForOnboarding` on the host-onboarding flow),
 * so a tourist subscription can end up being "the" accommodation
 * subscription `loadEntitlements`/`checkEligibility` find for them. Without
 * this check, that tourist plan's entitlements (which do NOT include
 * `EDIT_ACCOMMODATION_INFO`/`PUBLISH_ACCOMMODATIONS`) get resolved instead of
 * falling back to the `owner-basico` draft defaults, and the owner is
 * incorrectly treated as eligible to publish.
 *
 * Reads `billing_plans.metadata->>'category'` directly (the same jsonb path
 * `plan.crud.ts`'s `mapDbToPlan` uses) rather than going through the full
 * `getPlanById` CRUD helper, to avoid the extra `billing_prices` join on a
 * hot path (`loadEntitlements` runs on every entitlement-cache miss;
 * `checkEligibility` runs on every publish attempt) — mirrors
 * {@link loadSubscriptionDiscountState}'s "narrow typed query" convention in
 * this same file rather than pulling in the heavier CRUD module.
 *
 * Soft-deleted plans (`deletedAt IS NOT NULL`) are excluded and treated as
 * "not an owner plan" (fail-closed) — same as `getPlanById`'s NOT_FOUND
 * behavior for a deleted plan.
 *
 * A `null`/`undefined` `category` (metadata without the key at all) is
 * treated as `'owner'` — matching `mapDbToPlan`'s (`plan.crud.ts`) legacy
 * default for the same field, so a plan predating the `category` metadata
 * key resolves identically whether read through this narrow query or the
 * full CRUD helper.
 *
 * @param input.planId - The subscription's `planId` (`billing_plans.id`).
 * @param input.tx - Optional Drizzle client (e.g. a caller-provided
 *   transaction) so the read participates in the caller's boundary. Defaults
 *   to a standalone `getDb()` connection.
 * @returns `true` when the plan's category is `'owner'` or `'complex'`;
 *   `false` for `'tourist'` or when the plan cannot be found (fail-closed).
 *
 * @example
 * ```ts
 * const isRealOwnerSub = await isOwnerCategorySubscription({ planId: activeSubscription.planId });
 * if (!isRealOwnerSub) {
 *   // treat as "no owner subscription" — fall back to owner-basico draft defaults
 * }
 * ```
 */
export async function isOwnerCategorySubscription(input: {
    planId: string;
    tx?: DrizzleClient;
}): Promise<boolean> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .select({ category: sql<string | null>`${billingPlans.metadata}->>'category'` })
        .from(billingPlans)
        .where(and(eq(billingPlans.id, input.planId), isNull(billingPlans.deletedAt)))
        .limit(1);

    if (!row) {
        return false;
    }

    const category = row.category ?? 'owner';
    return category === 'owner' || category === 'complex';
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
