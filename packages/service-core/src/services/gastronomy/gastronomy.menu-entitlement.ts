/**
 * Live resolver for "does this gastronomy owner's PLAN currently grant
 * `MANAGE_GASTRONOMY_MENU`" (HOS-895 PR2).
 *
 * ## Why this exists, and why it is a live read rather than a synced column
 *
 * Building the structured carta was already gated on the write route
 * (`PUT .../menu`) from PR1. The uploaded photo/PDF (`POST .../menu-file`) was
 * NOT — every gastronomy tier could upload one. Owner decision (2026-09-02)
 * reversed that: the attachment is now `-pro`/`-premium` too, matching the
 * structured carta.
 *
 * That write-side change alone is not enough. Rows written BEFORE this PR — a
 * `-basico` owner's already-uploaded menu photo, or a downgraded `-pro`
 * owner's already-typed carta — keep their data in the database; only the
 * WRITE is newly refused. Showing that data on the public page regardless
 * would hand `-basico` venues the paid presentation for free, which is exactly
 * what the gate exists to prevent. So the public detail route asks this
 * resolver, live, on every read: does the CURRENT subscription still carry the
 * entitlement.
 *
 * This mirrors `featured-entitlement.resolver.ts`'s
 * `resolveOwnerPlanGrantsFeatured` deliberately — same layering (direct
 * Drizzle over `billing_customers` / `billing_subscriptions` / `billing_plans`,
 * because `service-core` cannot depend on the QZPay SDK an `apps/api`-only
 * helper wraps), same fail-closed default, and the same reason a synced column
 * is NOT used here: HOS-895 PR2 introduces no migration, so there is nowhere
 * to persist a denormalized flag. A follow-up MAY revisit that trade-off if
 * the live read shows up in profiling; until then this is the whole
 * mechanism, and it also means a plan CHANGE takes effect at the next
 * (possibly CDN-cached) read rather than instantly.
 *
 * @module services/gastronomy/gastronomy.menu-entitlement
 */

import { ENTITLEMENT_GRANTING_STATUSES, EntitlementKey } from '@repo/billing';
import {
    and,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { subscriptionMatchesDomain } from '../billing/subscription/subscription-product-domain.js';

/**
 * Subscription statuses that keep a plan's entitlements reachable.
 *
 * Aliased to the canonical {@link ENTITLEMENT_GRANTING_STATUSES} rather than
 * re-declared — see `featured-entitlement.resolver.ts` for why a hand-rolled
 * duplicate of this set is how HOS-238/239/594 each shipped a drift bug.
 */
const ACTIVE_PLAN_SUBSCRIPTION_STATUSES = ENTITLEMENT_GRANTING_STATUSES;

/**
 * Input for {@link resolveOwnerGrantsGastronomyMenuManagement}.
 */
export interface ResolveOwnerGrantsGastronomyMenuManagementInput {
    /** `users.id` of the gastronomy listing owner. */
    readonly ownerId: string;
}

/**
 * The menu-related grants of one owner's current gastronomy plan (HOS-1045).
 *
 * Two booleans travelling together because they are read together, on the same
 * request, out of the SAME three queries. Asking for them separately would
 * double a three-round-trip lookup on the busiest public page in the vertical
 * and — worse — would let the two answers come from different instants.
 */
export interface GastronomyMenuGrants {
    /** `manage_gastronomy_menu`: the structured carta and the uploaded file. */
    readonly manageMenu: boolean;
    /** `menu_item_photos`: a photo attached to each dish (premium only). */
    readonly menuItemPhotos: boolean;
}

/** Every grant `false` — the fail-closed answer for an unresolvable owner. */
const NO_MENU_GRANTS: GastronomyMenuGrants = { manageMenu: false, menuItemPhotos: false };

/**
 * Resolves which menu capabilities the owner's CURRENT gastronomy subscription
 * plan grants (HOS-895 for the carta, HOS-1045 for the dish photos).
 *
 * Looks up the owner's billing customer, then their active/trialing/comp
 * GASTRONOMY-domain subscription (SPEC-239 isolation — an owner who is also a
 * host or an experience provider must not have that subscription's plan
 * consulted here), then reads that plan's `entitlements` array ONCE and answers
 * every key from it.
 *
 * Fails closed (every grant `false`) when the owner has no billing customer, no
 * qualifying subscription, or the resolved plan is missing / has no
 * entitlements array — the same direction `resolveOwnerPlanGrantsFeatured`
 * fails in, and for the same reason: an unresolvable plan must never be read
 * as "paid for it".
 *
 * @param input - The owner id to resolve.
 * @returns The owner's menu grants.
 */
export async function resolveOwnerGastronomyMenuGrants(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<GastronomyMenuGrants> {
    const db = getDb();

    const [customer] = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(
            and(eq(billingCustomers.externalId, input.ownerId), isNull(billingCustomers.deletedAt))
        )
        .limit(1);

    if (!customer) {
        return NO_MENU_GRANTS;
    }

    const subscriptionRows = await db
        .select({
            id: billingSubscriptions.id,
            planId: billingSubscriptions.planId,
            status: billingSubscriptions.status,
            productDomain: billingSubscriptions.productDomain
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customer.id),
                isNull(billingSubscriptions.deletedAt),
                inArray(billingSubscriptions.status, ACTIVE_PLAN_SUBSCRIPTION_STATUSES)
            )
        );

    const gastronomySubscription = subscriptionRows.find((row) =>
        subscriptionMatchesDomain(row, ProductDomainEnum.GASTRONOMY)
    );

    if (!gastronomySubscription) {
        return NO_MENU_GRANTS;
    }

    const [plan] = await db
        .select({ entitlements: billingPlans.entitlements })
        .from(billingPlans)
        .where(
            and(eq(billingPlans.id, gastronomySubscription.planId), isNull(billingPlans.deletedAt))
        )
        .limit(1);

    if (!plan || !Array.isArray(plan.entitlements)) {
        return NO_MENU_GRANTS;
    }

    const granted = plan.entitlements as string[];

    return {
        manageMenu: granted.includes(EntitlementKey.MANAGE_GASTRONOMY_MENU),
        menuItemPhotos: granted.includes(EntitlementKey.MENU_ITEM_PHOTOS)
    };
}

/**
 * Whether the owner's current gastronomy plan grants `MANAGE_GASTRONOMY_MENU`.
 *
 * Kept as its own export after HOS-1045 widened the resolver above: it is the
 * name five JSDoc blocks across `apps/api` point at, and a caller that needs
 * exactly one boolean should not have to know the shape of the other.
 *
 * @param input - The owner id to resolve.
 * @returns `true` when the plan includes `MANAGE_GASTRONOMY_MENU`.
 */
export async function resolveOwnerGrantsGastronomyMenuManagement(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<boolean> {
    const { manageMenu } = await resolveOwnerGastronomyMenuGrants(input);
    return manageMenu;
}
