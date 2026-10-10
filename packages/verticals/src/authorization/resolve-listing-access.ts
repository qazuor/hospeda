import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import { resolveEntitlementStep } from './entitlement-step';
import { type ListingOperation, OPERATION_STEP6_KEY } from './listing-operation';
import { type ListingAccessFacts, resolveResourceStep } from './resource-step';
import { resolveResourceVertical } from './resource-vertical';

/**
 * Resolve listing access through the authorization chain (steps 1, 2, 3, 4, 6).
 *
 * Step 1 — "quién es": rejects the guest (actorId null or empty) on every
 * operation except READ_PUBLIC.  The caller must pass `actorId: null` to
 * represent a guest — the real API guest actor carries a UUID (checked via
 * `isGuestActor(actor)` in apps/api).
 *
 * The vertical pre-condition (context step) runs BEFORE step 1.  If a guest
 * declares a mismatched vertical they receive `NOT_FOUND`, not
 * `UNAUTHENTICATED`.
 *
 * @param args.actorId — the authenticated user id, or `null`/`''` for a
 *       guest (the real API guest carries a UUID; use `isGuestActor` to
 *       collapse it to `null`).
 * @returns `{ allowed: true }` with evaluated steps, or `{ allowed: false,
 *       reason }` where reason is `'NOT_FOUND'`, `'NO_CAPABILITY'`, or
 *       `'UNAUTHENTICATED'`.
 */
export async function resolveListingAccess(args: {
    readonly actorId: string | null;
    readonly vertical: string;
    readonly declaredVertical?: string | null;
    readonly facts: ListingAccessFacts | null;
    readonly operation: ListingOperation;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly catalog: Pick<PlanCatalogReader, 'findPlanVersionEffects'>;
}): Promise<
    | { readonly allowed: true; readonly evaluatedSteps: readonly (4 | 6)[] }
    | {
          readonly allowed: false;
          readonly reason: 'NOT_FOUND' | 'NO_CAPABILITY' | 'UNAUTHENTICATED';
      }
> {
    const vertical = resolveResourceVertical({
        resourceVertical: args.vertical,
        declaredVertical: args.declaredVertical
    });
    if (!vertical.allowed) return vertical;
    // Step 1 — "quién es": guest fails except for READ_PUBLIC.
    if (!args.actorId && args.operation !== 'READ_PUBLIC')
        return { allowed: false, reason: 'UNAUTHENTICATED' };
    const resource = resolveResourceStep(args);
    if (!resource.allowed) return resource;
    const requirement = OPERATION_STEP6_KEY[args.operation];
    if (requirement.kind === 'NONE') return { allowed: true, evaluatedSteps: [4] };
    if (requirement.kind === 'PENDING') return { allowed: false, reason: 'NO_CAPABILITY' };
    if (args.actorId === null) return { allowed: false, reason: 'NOT_FOUND' };
    const entitlement = await resolveEntitlementStep({
        userId: args.actorId,
        vertical: args.vertical,
        key: requirement.key,
        billing: args.billing,
        catalog: args.catalog
    });
    return entitlement.allowed ? { allowed: true, evaluatedSteps: [4, 6] } : entitlement;
}
