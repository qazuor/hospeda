import {
    type BillingForVerticals,
    type CoverageSource,
    coverageSourceClassOf
} from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import { UnresolvedCoverageSourceError } from './resolve-effective-set';

/** The first live title whose plan version grants Tourist VIP, or no inheritance. */
export type TouristVipInheritance =
    | { readonly inherits: false }
    | {
          readonly inherits: true;
          readonly source: CoverageSource;
          readonly planVersionId: string;
      };

/** Resolves Tourist VIP inheritance from live titles in other verticals. */
export async function resolveTouristVipInheritance(args: {
    readonly userId: string;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly reader: Pick<PlanCatalogReader, 'findPlanVersion'>;
}): Promise<TouristVipInheritance> {
    for (const vertical of Object.values(VerticalEnum)) {
        if (vertical === VerticalEnum.TOURIST) continue;
        const coverage = await args.billing.coverage({ userId: args.userId, vertical });
        for (const source of coverage.sources) {
            if (
                coverageSourceClassOf({ source }).sourceClass !== 'TITLE' ||
                source.type === 'TRIAL' ||
                source.reference.kind !== 'PLAN_VERSION'
            )
                continue;
            const planVersionId = source.reference.planVersionId;
            const version = await args.reader.findPlanVersion({ id: planVersionId });
            if (!version) throw new UnresolvedCoverageSourceError(source.type);
            if (version.inheritsTouristVip === true)
                return { inherits: true, source, planVersionId };
        }
    }
    return { inherits: false };
}
