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
 * The plan `entitlements` array of one owner's CURRENT gastronomy subscription.
 *
 * ## One query body, and why every export below is a thin test over it
 *
 * HOS-1041 generalised what HOS-895 had written with the key inlined, on the
 * grounds that copying the lookup for a second key produces a resolver that
 * drifts from the first — the failure `featured-entitlement.resolver.ts`
 * records for `ENTITLEMENT_GRANTING_STATUSES`, shipped three times. That rule
 * is kept, and pushed one step further: the shared thing is no longer "the
 * lookup plus one `includes`" but the LOOKUP ITSELF, so that a caller needing
 * two keys at once can have them without a second round trip (HOS-1045).
 *
 * Looks up the owner's billing customer, then their active/trialing/comp
 * GASTRONOMY-domain subscription (SPEC-239 isolation — an owner who is also a
 * host or an experience provider must not have that subscription's plan
 * consulted here), then that plan's `entitlements`.
 *
 * Returns `null`, never `[]`, when the owner has no billing customer, no
 * qualifying subscription, or the plan is missing / has no entitlements array.
 * Every caller reads `null` as "grants nothing" — the same direction
 * `resolveOwnerPlanGrantsFeatured` fails in, and for the same reason: an
 * unresolvable plan must never be read as "paid for it". `null` rather than an
 * empty array so the two situations stay distinguishable to a future caller
 * that needs to tell "no plan" from "a plan that grants nothing".
 *
 * @param ownerId - `users.id` of the gastronomy listing owner.
 * @returns The plan's entitlement keys, or `null` when unresolvable.
 */
async function resolveOwnerGastronomyPlanEntitlements(
    ownerId: string
): Promise<readonly string[] | null> {
    const db = getDb();

    const [customer] = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(and(eq(billingCustomers.externalId, ownerId), isNull(billingCustomers.deletedAt)))
        .limit(1);

    if (!customer) {
        return null;
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
        return null;
    }

    const [plan] = await db
        .select({ entitlements: billingPlans.entitlements })
        .from(billingPlans)
        .where(
            and(eq(billingPlans.id, gastronomySubscription.planId), isNull(billingPlans.deletedAt))
        )
        .limit(1);

    if (!plan || !Array.isArray(plan.entitlements)) {
        return null;
    }

    return plan.entitlements as string[];
}

/**
 * The owner's current gastronomy grants as a SET, for a caller that needs
 * several keys at once (HOS-1042).
 *
 * The public detail route reads THREE gated features off one owner on one
 * render — the carta (HOS-895), the menú del día (HOS-1041) and the venue
 * agenda (HOS-1042) — plus the per-dish photo flag (HOS-1045). Asking
 * {@link resolveOwnerGrantsGastronomyEntitlement} once per key would multiply
 * a three-query lookup by the number of keys, and would let the answers come
 * from different reads of the same subscription if a plan change landed
 * mid-render: the page would publish one paid feature and withhold another for
 * no reason a reader could see.
 *
 * A thin projection of the shared body above, so there is still exactly ONE
 * place that knows how to find an owner's plan.
 *
 * `null` (unresolvable) collapses to an EMPTY set here, which every caller
 * reads as "grants nothing" — the fail-closed direction the body documents.
 * A caller that must tell "no plan" from "a plan granting nothing" should use
 * the body's own `null` through one of the boolean helpers instead.
 *
 * @param input - The owner id to resolve.
 * @returns The entitlement keys the owner's gastronomy plan grants; empty when
 *   there is no customer, no qualifying subscription, or no readable plan.
 */
export async function resolveOwnerGastronomyPlanEntitlementSet(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<ReadonlySet<string>> {
    return new Set((await resolveOwnerGastronomyPlanEntitlements(input.ownerId)) ?? []);
}

/**
 * Input for {@link resolveOwnerGrantsGastronomyEntitlement}.
 */
export interface ResolveOwnerGrantsGastronomyEntitlementInput
    extends ResolveOwnerGrantsGastronomyMenuManagementInput {
    /** The key to test against the resolved plan's `entitlements` array. */
    readonly entitlementKey: EntitlementKey;
}

/**
 * Resolves whether the owner's CURRENT gastronomy subscription plan grants an
 * arbitrary entitlement key (HOS-1041).
 *
 * Fails closed. See {@link resolveOwnerGastronomyPlanEntitlements} for the
 * lookup and for why it is shared.
 *
 * @param input.ownerId - The owner id to resolve.
 * @param input.entitlementKey - The entitlement to look for.
 * @returns `true` when the owner's gastronomy plan includes the key; `false`
 *   otherwise.
 */
export async function resolveOwnerGrantsGastronomyEntitlement(
    input: ResolveOwnerGrantsGastronomyEntitlementInput
): Promise<boolean> {
    const granted = await resolveOwnerGastronomyPlanEntitlements(input.ownerId);
    return granted?.includes(input.entitlementKey) ?? false;
}

/**
 * The menu-related grants of one owner's current gastronomy plan (HOS-1045).
 *
 * Two booleans travelling together because they are read together, on the same
 * request, out of the SAME three queries. Asking for them one at a time would
 * double a three-round-trip lookup on the busiest public page in the vertical
 * and — worse — would let the two answers come from different instants.
 */
export interface GastronomyMenuGrants {
    /** `manage_gastronomy_menu`: the structured carta and the uploaded file. */
    readonly manageMenu: boolean;
    /** `menu_item_photos`: a photo attached to each dish (premium only). */
    readonly menuItemPhotos: boolean;
}

/**
 * Resolves both menu capabilities in ONE pass (HOS-895 for the carta, HOS-1045
 * for the dish photos).
 *
 * Exists alongside the single-key resolver above rather than instead of it:
 * the public detail route needs both answers on the same render, and the photo
 * gate nests inside the carta gate, so two independent lookups could disagree
 * about which instant they describe. Both read the same shared body, so there
 * is still exactly one place that knows how to find an owner's plan.
 *
 * @param input - The owner id to resolve.
 * @returns The owner's menu grants; every grant `false` when unresolvable.
 */
export async function resolveOwnerGastronomyMenuGrants(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<GastronomyMenuGrants> {
    const granted = await resolveOwnerGastronomyPlanEntitlements(input.ownerId);

    return {
        manageMenu: granted?.includes(EntitlementKey.MANAGE_GASTRONOMY_MENU) ?? false,
        menuItemPhotos: granted?.includes(EntitlementKey.MENU_ITEM_PHOTOS) ?? false
    };
}

/**
 * Resolves whether the owner's CURRENT gastronomy plan grants
 * `MANAGE_GASTRONOMY_MENU` — the structured carta and the uploaded photo/PDF
 * (HOS-895 PR2).
 *
 * Kept as its own export: it is the name five JSDoc blocks across `apps/api`
 * point at, and a caller that needs exactly one boolean should not have to
 * know the shape of the others.
 *
 * @param input - The owner id to resolve.
 * @returns `true` when the owner's gastronomy plan includes
 *   `MANAGE_GASTRONOMY_MENU`; `false` otherwise.
 */
export async function resolveOwnerGrantsGastronomyMenuManagement(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<boolean> {
    return await resolveOwnerGrantsGastronomyEntitlement({
        ownerId: input.ownerId,
        entitlementKey: EntitlementKey.MANAGE_GASTRONOMY_MENU
    });
}

/**
 * Resolves whether the owner's CURRENT gastronomy plan grants
 * `MANAGE_GASTRONOMY_DAILY_SPECIAL` — the menú del día (HOS-1041).
 *
 * Used by the public detail route to withhold today's specials from a listing
 * whose owner is no longer on `-pro` or above. The rows are NOT deleted: a
 * downgraded owner's specials are still theirs, and they reappear the moment
 * the plan does — the same live-read stance the carta takes, for the same
 * reason.
 *
 * @param input - The owner id to resolve.
 * @returns `true` when the owner's gastronomy plan includes
 *   `MANAGE_GASTRONOMY_DAILY_SPECIAL`; `false` otherwise.
 */
export async function resolveOwnerGrantsGastronomyDailySpecial(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<boolean> {
    return await resolveOwnerGrantsGastronomyEntitlement({
        ownerId: input.ownerId,
        entitlementKey: EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL
    });
}
