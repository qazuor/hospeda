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
    isNull,
    sql
} from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';

/**
 * The product-domain values that denote a commerce vertical.
 *
 * HOS-695 (release C) retired the transitional `COMMERCE` umbrella: every
 * commerce row was rewritten to its own vertical in release B (HOS-692), and
 * the value no longer exists in {@link ProductDomainEnum} at all. A row that
 * still somehow carries the old `'commerce'` string (it should not, past
 * release B) is no longer recognised as a commerce subscription by anything
 * in this file — that is the narrowing this release exists to make.
 */
const COMMERCE_DOMAINS: readonly ProductDomainValue[] = [
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
];

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
 * To test membership across every commerce vertical at once, use
 * {@link isCommerceSubscription} rather than re-deriving that union at the
 * call site.
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
 * Returns `true` when the subscription belongs to **any** commerce vertical
 * (SPEC-239 commerce-listing subscriptions).
 *
 * Unlike {@link isAccommodationSubscription}, this predicate is deliberately
 * **fail-closed**: `null`/`undefined`/non-object input, or a `productDomain`
 * outside {@link COMMERCE_DOMAINS}, returns `false`. A commerce subscription is
 * always created with an explicit domain (there is no legacy-row ambiguity to
 * resolve in this domain's favor the way there is for accommodation), so
 * silently including an unrelated row here would leak an accommodation/partner
 * subscription into a commerce-scoped read (HOS-259).
 *
 * Answers `true` for `'gastronomy'` and `'experience'` — the two live
 * verticals — by delegating to {@link subscriptionMatchesDomain} for each and
 * OR-ing the results, so this stays a thin composition rather than a second
 * place that reads `productDomain` itself. **Narrowed in HOS-695 (release
 * C)**: it no longer answers `true` for the retired `'commerce'` umbrella —
 * that string is not a member of {@link ProductDomainEnum} any more, and a
 * row still carrying it (it should not, past release B / HOS-692) is treated
 * as unrecognised, not as commerce. To scope a read to **one** vertical, call
 * {@link subscriptionMatchesDomain} with that vertical instead.
 *
 * @param sub - Any object returned by `billing.subscriptions.getByCustomerId()`.
 * @returns `true` when the row's `productDomain` is any commerce vertical.
 *
 * @example
 * ```ts
 * const commerceSub = subscriptions.find(
 *   (sub) => isEntitlementGrantingStatus(sub.status) && isCommerceSubscription(sub)
 * );
 * ```
 */
export function isCommerceSubscription(sub: unknown): boolean {
    return COMMERCE_DOMAINS.some((domain) => subscriptionMatchesDomain(sub, domain));
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
