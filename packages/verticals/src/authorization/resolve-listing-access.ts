import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import { resolveEntitlementStep } from './entitlement-step';
import { type ListingOperation, OPERATION_STEP6_KEY } from './listing-operation';
import { type ListingAccessFacts, resolveResourceStep } from './resource-step';
import { resolveResourceVertical } from './resource-vertical';

/** Resolve the resource first, then the BASE capability required by an operation. */
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
    | { readonly allowed: false; readonly reason: 'NOT_FOUND' | 'NO_CAPABILITY' }
> {
    const vertical = resolveResourceVertical({
        resourceVertical: args.vertical,
        declaredVertical: args.declaredVertical
    });
    if (!vertical.allowed) return vertical;
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
