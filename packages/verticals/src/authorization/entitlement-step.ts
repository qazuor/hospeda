import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { getCatalogKey, VerticalEnumSchema } from '@repo/schemas';
import { foldPlegableSet } from '../effective-set/fold';
import type { FoldableSource } from '../effective-set/types';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import type { StepOutcome } from './resource-step';

/** A caller passed a commercial or unknown key to the temporary BASE-only resolver. */
export class NonBaseKeyError extends Error {
    constructor(readonly key: string) {
        super(`Step 6 only accepts BASE keys: ${key}`);
        this.name = 'NonBaseKeyError';
    }
}

/**
 * Step 6 for BASE keys only, pending V3.4's effective-set resolver. It does not
 * apply grant or trial ratchets or key scope, so it cannot decide commercial keys.
 */
export async function resolveEntitlementStep(args: {
    readonly userId: string;
    readonly vertical: string;
    readonly key: string;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly catalog: Pick<PlanCatalogReader, 'findPlanVersionEffects'>;
}): Promise<StepOutcome<'NO_CAPABILITY'>> {
    const definition = getCatalogKey({ key: args.key });
    if (definition?.keyClass !== 'BASE') throw new NonBaseKeyError(args.key);
    const { sources } = await args.billing.coverage({
        userId: args.userId,
        vertical: VerticalEnumSchema.parse(args.vertical)
    });
    const foldable: FoldableSource[] = await Promise.all(
        sources.map(async (source) => {
            if (source.reference.kind !== 'PLAN_VERSION') return { source, grants: [] };
            const effects = await args.catalog.findPlanVersionEffects({
                id: source.reference.planVersionId
            });
            return {
                source,
                grants: effects.entitlements.map((entitlement) => ({
                    key: entitlement.key,
                    value: entitlement.planQuota ?? Number.POSITIVE_INFINITY,
                    strategy: entitlement.aggregationStrategy
                }))
            };
        })
    );
    return foldPlegableSet({ sources: foldable }).has(args.key)
        ? { allowed: true }
        : { allowed: false, reason: 'NO_CAPABILITY' };
}
