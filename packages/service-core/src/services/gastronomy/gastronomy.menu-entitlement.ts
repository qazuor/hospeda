/**
 * Live resolver for "what does this gastronomy owner's PLAN currently grant"
 * (HOS-895 PR2, widened from one key to the whole set by HOS-1042).
 *
 * The filename still says `menu-entitlement` because the carta was the first
 * question asked here and renaming a file is how a text-matching guard
 * elsewhere in the repo silently stops matching. What the module answers is the
 * general one: the entitlement set of the owner's live gastronomy plan, from
 * which `MANAGE_GASTRONOMY_MENU` and `MANAGE_GASTRONOMY_EVENTS` are both read.
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
 * The fail-closed answer: no plan resolved, therefore no grants.
 *
 * A FUNCTION returning a fresh set, not a shared constant. `Object.freeze` does
 * not seal a `Set`'s contents — `.add()` still works on a frozen one — so a
 * module-level singleton would be one stray mutation away from handing a grant
 * to every unresolvable owner from that moment on. `ReadonlySet` stops that at
 * compile time; a fresh set stops it at runtime too, and costs nothing on a
 * path that is already three queries deep.
 *
 * @returns An empty entitlement set.
 */
const noEntitlements = (): ReadonlySet<string> => new Set<string>();

/**
 * Input for {@link resolveOwnerGrantsGastronomyMenuManagement}.
 */
export interface ResolveOwnerGrantsGastronomyMenuManagementInput {
    /** `users.id` of the gastronomy listing owner. */
    readonly ownerId: string;
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
 * Resolves the FULL entitlement set of the owner's current gastronomy plan
 * (HOS-1042, merged with HOS-1041's key-parameterised resolver).
 *
 * Introduced when a SECOND tier-gated gastronomy capability appeared — the
 * venue events agenda alongside the structured carta — and the public detail
 * route needed both answers about the same owner on the same render. Asking the
 * boolean question twice would mean three extra queries per page view for the
 * second key, and, worse, would let the two answers come from different reads
 * of the same subscription if a plan change landed between them.
 *
 * So the shared query answers once and the callers ask the set. Everything the
 * boolean version documented still holds: a live read on every render rather
 * than a synced column (a plan downgrade must take effect without a migration),
 * the SPEC-239 domain isolation (an owner who is also a host or an experience
 * provider must not have THAT subscription's plan consulted), and the fail-
 * closed direction — an unresolvable plan yields an EMPTY set, never a
 * permissive one.
 *
 * Unknown strings are returned as-is rather than dropped. The column is
 * `string[]` and this function's job is to report what the plan row says; the
 * caller compares against a known key, so a retired grant spelled like an
 * entitlement matches nothing.
 *

 * ## One body, and why it returns the SET rather than a boolean
 *
 * HOS-1041 and HOS-1042 independently refactored this module away from the
 * inlined `MANAGE_GASTRONOMY_MENU` it was born with, and for the same stated
 * reason: a copied three-query body is how `featured-entitlement.resolver.ts`
 * records `ENTITLEMENT_GRANTING_STATUSES` drifting across three PRs. They
 * differed only in the shape of the seam — a key PARAMETER returning a boolean,
 * or no parameter returning the whole set.
 *
 * The set wins on the merged branch because the public detail route now needs
 * THREE keys about the same owner on the same render (carta, menú del día,
 * agenda). Per-key booleans would be nine queries where this is three, and —
 * worse — would let the three answers come from different reads of the same
 * subscription if a plan change landed mid-render, publishing one paid feature
 * while withholding another for no reason a reader could see.
 *
 * `resolveOwnerGrantsGastronomyEntitlement` is kept as HOS-1041 defined it and
 * now delegates here, so both call styles exist and there is still exactly one
 * query body.
 *
 * @param input - The owner id to resolve.
 * @returns The entitlement keys the owner's gastronomy plan grants. Empty when
 *   there is no customer, no qualifying subscription, or no readable plan.
 */
export async function resolveOwnerGastronomyPlanEntitlements(
    input: ResolveOwnerGrantsGastronomyMenuManagementInput
): Promise<ReadonlySet<string>> {
    const db = getDb();

    const [customer] = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(
            and(eq(billingCustomers.externalId, input.ownerId), isNull(billingCustomers.deletedAt))
        )
        .limit(1);

    if (!customer) {
        return noEntitlements();
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
        return noEntitlements();
    }

    const [plan] = await db
        .select({ entitlements: billingPlans.entitlements })
        .from(billingPlans)
        .where(
            and(eq(billingPlans.id, gastronomySubscription.planId), isNull(billingPlans.deletedAt))
        )
        .limit(1);

    if (!plan || !Array.isArray(plan.entitlements)) {
        return noEntitlements();
    }

    return new Set(plan.entitlements as string[]);
}

/**
 * Resolves whether the owner's CURRENT gastronomy plan grants ONE key
 * (HOS-1041).
 *
 * Delegates to {@link resolveOwnerGastronomyPlanEntitlements}. Correct for a
 * caller that needs a single answer; a caller needing SEVERAL keys on the same
 * render must take the set once instead of calling this N times, for the two
 * reasons that function's doc gives.
 *
 * @param input.ownerId - The owner id to resolve.
 * @param input.entitlementKey - The entitlement to look for.
 * @returns `true` when the owner's gastronomy plan includes the key; `false`
 *   otherwise.
 */
export async function resolveOwnerGrantsGastronomyEntitlement(
    input: ResolveOwnerGrantsGastronomyEntitlementInput
): Promise<boolean> {
    const entitlements = await resolveOwnerGastronomyPlanEntitlements({
        ownerId: input.ownerId
    });
    return entitlements.has(input.entitlementKey);
}

/**
 * Resolves whether the owner's CURRENT gastronomy plan grants
 * `MANAGE_GASTRONOMY_MENU` — the structured carta and the uploaded photo/PDF
 * (HOS-895 PR2).
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
