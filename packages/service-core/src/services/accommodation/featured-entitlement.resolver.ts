/**
 * Featured-entitlement resolver helpers (SPEC-309 T-004).
 *
 * Single source of truth for "does this owner / accommodation currently hold
 * an active FEATURED_LISTING entitlement" — replaces the duplicated
 * `getPlanBySlug(...).entitlements.includes(EntitlementKey.FEATURED_LISTING)`
 * check copy-pasted across 8 billing call-sites (SPEC-309 H-1).
 *
 * **Two independent sources, resolved separately (SPEC-309 OQ-3):** the
 * owner's PLAN grants featuring owner-wide (all of the owner's
 * accommodations); a customer's ADDON purchase (`visibility-boost-7d` /
 * `-30d`) grants featuring scoped to the single accommodation it was
 * purchased for (`featured_listing_addon_grants`, T-002). Callers combine
 * both (T-005) rather than this module returning one blended boolean, so the
 * addon-scoped case never silently broadens to the owner's whole portfolio.
 *
 * **Layering:** direct Drizzle queries via `getDb()`, no BaseCrudService —
 * mirrors `accommodation.sync-featured-by-plan.ts`. `resolveOwnerPlanGrantsFeatured`
 * cannot use the QZPay SDK (`getQZPayBilling()`), because that helper lives in
 * `apps/api` and `service-core` cannot depend on an app package — so it
 * queries `billing_customers` / `billing_subscriptions` / `billing_plans`
 * directly instead. This also makes it callable from the reconcile cron
 * (`featured-by-entitlement-reconcile.job.ts`, T-014), which used to duplicate
 * this same lookup via the QZPay SDK.
 *
 * @module services/accommodation/featured-entitlement-resolver
 */

import { EntitlementKey } from '@repo/billing';
import {
    accommodations,
    and,
    billingAddonPurchases,
    billingCustomers,
    billingPlans,
    eq,
    featuredListingAddonGrants,
    getDb,
    gt,
    isNull,
    or,
    sql
} from '@repo/db';
import { isAccommodationSubscription } from '../billing/subscription/subscription-product-domain.js';

/**
 * Subscription statuses that keep a plan's entitlements reachable.
 * Mirrors `featured-by-entitlement-reconcile.job.ts`'s `active | trialing | comp`
 * set (SPEC-309 OQ resolution / G-5: `comp` counts, `paused` does not).
 */
const ACTIVE_PLAN_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'comp'] as const;

/**
 * Raw shape of a `billing_subscriptions` row selected via SQL, including the
 * extras-carril `product_domain` column that is not on the Drizzle TS schema.
 */
interface RawBillingSubscriptionRow {
    id: string;
    plan_id: string;
    status: string;
    product_domain: string | null;
}

// ---------------------------------------------------------------------------
// resolveOwnerPlanGrantsFeatured
// ---------------------------------------------------------------------------

/**
 * Input for {@link resolveOwnerPlanGrantsFeatured}.
 */
export interface ResolveOwnerPlanGrantsFeaturedInput {
    /** `users.id` of the accommodation owner. */
    readonly ownerId: string;
}

/**
 * Resolves whether the owner's PLAN currently grants FEATURED_LISTING.
 *
 * Looks up the owner's billing customer, then their active/trialing/comp
 * ACCOMMODATION-domain subscription (SPEC-239 isolation — an owner who is
 * also a commerce customer must not have a commerce subscription's plan
 * consulted here), then checks that plan's `entitlements` array.
 *
 * Fails closed (`false`) when the owner has no billing customer, no
 * qualifying subscription, or the resolved plan is missing / has no
 * entitlements array. This is the owner-wide half of the union; the
 * accommodation-scoped addon half is {@link resolveAccommodationHasActiveFeaturedAddon}.
 *
 * @param input - The owner id to resolve.
 * @returns `true` when the owner's plan includes FEATURED_LISTING; `false` otherwise.
 */
export async function resolveOwnerPlanGrantsFeatured(
    input: ResolveOwnerPlanGrantsFeaturedInput
): Promise<boolean> {
    const db = getDb();

    const [customer] = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(
            and(eq(billingCustomers.externalId, input.ownerId), isNull(billingCustomers.deletedAt))
        )
        .limit(1);

    if (!customer) {
        return false;
    }

    // `product_domain` is an extras-carril column (SPEC-239), not on the
    // Drizzle TS schema for billing_subscriptions — read via raw SQL, same
    // pattern as `subscription-comp-create.service.ts`.
    const statusList = sql.join(
        ACTIVE_PLAN_SUBSCRIPTION_STATUSES.map((status) => sql`${status}`),
        sql`, `
    );
    const subscriptionsResult = await db.execute(
        sql`SELECT id, plan_id, status, product_domain FROM billing_subscriptions
            WHERE customer_id = ${customer.id} AND deleted_at IS NULL
            AND status IN (${statusList})`
    );
    // TYPE-WORKAROUND: db.execute() returns untyped rows for raw SQL; the
    // shape is guaranteed by the SELECT column list above.
    const subscriptionRows = (subscriptionsResult.rows ??
        []) as unknown as RawBillingSubscriptionRow[];

    const accommodationSubscription = subscriptionRows.find((row) =>
        isAccommodationSubscription(row)
    );

    if (!accommodationSubscription) {
        return false;
    }

    const [plan] = await db
        .select({ entitlements: billingPlans.entitlements })
        .from(billingPlans)
        .where(
            and(
                eq(billingPlans.id, accommodationSubscription.plan_id),
                isNull(billingPlans.deletedAt)
            )
        )
        .limit(1);

    if (!plan || !Array.isArray(plan.entitlements)) {
        return false;
    }

    return (plan.entitlements as string[]).includes(EntitlementKey.FEATURED_LISTING);
}

// ---------------------------------------------------------------------------
// resolveAccommodationHasActiveFeaturedAddon
// ---------------------------------------------------------------------------

/**
 * Input for {@link resolveAccommodationHasActiveFeaturedAddon}.
 */
export interface ResolveAccommodationHasActiveFeaturedAddonInput {
    /** `accommodations.id` to check for an active featured-listing addon grant. */
    readonly accommodationId: string;
}

/**
 * Resolves whether a single accommodation currently holds an active
 * `visibility-boost` addon grant (SPEC-309 OQ-3: addon-derived featuring is
 * scoped to the accommodation it was purchased for, not owner-wide).
 *
 * A grant is active when its linked `billing_addon_purchases` row has
 * `status = 'active'` and either no expiry or a future expiry.
 *
 * @param input - The accommodation id to check.
 * @returns `true` when an active featured-listing addon grant exists for
 *   this accommodation; `false` otherwise.
 */
export async function resolveAccommodationHasActiveFeaturedAddon(
    input: ResolveAccommodationHasActiveFeaturedAddonInput
): Promise<boolean> {
    const db = getDb();

    const [grant] = await db
        .select({ id: featuredListingAddonGrants.id })
        .from(featuredListingAddonGrants)
        .innerJoin(
            billingAddonPurchases,
            eq(featuredListingAddonGrants.purchaseId, billingAddonPurchases.id)
        )
        .where(
            and(
                eq(featuredListingAddonGrants.accommodationId, input.accommodationId),
                eq(billingAddonPurchases.status, 'active'),
                or(
                    isNull(billingAddonPurchases.expiresAt),
                    gt(billingAddonPurchases.expiresAt, new Date())
                )
            )
        )
        .limit(1);

    return Boolean(grant);
}

// ---------------------------------------------------------------------------
// getOwnerAccommodationIdsWithActiveFeaturedAddon
// ---------------------------------------------------------------------------

/**
 * Input for {@link getOwnerAccommodationIdsWithActiveFeaturedAddon}.
 */
export interface GetOwnerAccommodationIdsWithActiveFeaturedAddonInput {
    /** `users.id` of the accommodation owner. */
    readonly ownerId: string;
}

/**
 * Returns the ids of all non-deleted accommodations owned by `ownerId` that
 * currently hold an active featured-listing addon grant.
 *
 * Consumed by T-005's revoke-exclusion logic: when a plan downgrade clears
 * owner-wide featuring, accommodations in this "protected" set must be
 * excluded from the clear, since their featuring is independently held by an
 * addon the plan change does not affect.
 *
 * @param input - The owner id to resolve protected accommodations for.
 * @returns The list of accommodation ids with an active featured-listing
 *   addon grant. Empty array when none exist.
 */
export async function getOwnerAccommodationIdsWithActiveFeaturedAddon(
    input: GetOwnerAccommodationIdsWithActiveFeaturedAddonInput
): Promise<string[]> {
    const db = getDb();

    const rows = await db
        .select({ accommodationId: featuredListingAddonGrants.accommodationId })
        .from(featuredListingAddonGrants)
        .innerJoin(
            billingAddonPurchases,
            eq(featuredListingAddonGrants.purchaseId, billingAddonPurchases.id)
        )
        .innerJoin(
            accommodations,
            eq(featuredListingAddonGrants.accommodationId, accommodations.id)
        )
        .where(
            and(
                eq(accommodations.ownerId, input.ownerId),
                isNull(accommodations.deletedAt),
                eq(billingAddonPurchases.status, 'active'),
                or(
                    isNull(billingAddonPurchases.expiresAt),
                    gt(billingAddonPurchases.expiresAt, new Date())
                )
            )
        );

    return rows.map((r) => r.accommodationId);
}
