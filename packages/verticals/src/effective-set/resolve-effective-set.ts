import type {
    BillingForVerticals,
    CoverageArgs,
    CoverageSource
} from '@repo/billing-verticals-contract';
import { getCatalogKey } from '@repo/schemas';
import type { BootstrapCoverageReader } from '../coverage/trial-and-base-sources';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import { foldPlegableSet } from './fold';
import { resolveGrantValues } from './grant-ratchet';
import { hasLiveNonTrialTitle } from './plegable';
import { resolveTrialValues } from './trial-ratchet';
import type { FoldableSource, SourceGrant } from './types';

export class UnresolvedCoverageSourceError extends Error {
    constructor(type: string) {
        super(`Cannot resolve coverage source: ${type}`);
        this.name = 'UnresolvedCoverageSourceError';
    }
}

export interface ResolvedEffectiveSet {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
    readonly hasLiveNonTrialTitle: boolean;
    readonly entries: readonly SourceGrant[];
}

export interface ResolveEffectiveSetArgs {
    readonly reader: PlanCatalogReader;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly trials: Pick<BootstrapCoverageReader, 'findTrial'>;
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
}

async function grantsOf(
    args: ResolveEffectiveSetArgs,
    source: CoverageSource
): Promise<readonly SourceGrant[]> {
    if (source.type === 'GRANT') {
        const values = await resolveGrantValues({
            ...args,
            billing: { coverage: async () => ({ covered: true, sources: [source] }) }
        });
        if (values === null) throw new UnresolvedCoverageSourceError('GRANT');
        return values;
    }
    if (source.type === 'TRIAL' && source.since !== 'NOT_STARTED') {
        const trial = await args.trials.findTrial({ userId: args.userId, vertical: args.vertical });
        if (!trial?.trialPlanId || !trial.floor) throw new UnresolvedCoverageSourceError('TRIAL');
        return resolveTrialValues({
            reader: args.reader,
            trial: {
                userId: args.userId,
                vertical: args.vertical,
                trialPlanId: trial.trialPlanId,
                floor: trial.floor
            }
        });
    }
    if (source.type === 'ADDON') {
        if (source.reference.kind !== 'ADDON_VERSION' || !args.reader.findAddonVersionEffects)
            throw new UnresolvedCoverageSourceError('ADDON');
        if (!(await args.reader.findAddonVersion({ id: source.reference.addonVersionId })))
            throw new UnresolvedCoverageSourceError('ADDON');
        const effects = await args.reader.findAddonVersionEffects({
            id: source.reference.addonVersionId
        });
        return [
            ...effects.entitlements.map((effect) => ({
                key: effect.key,
                value: Number.POSITIVE_INFINITY,
                strategy: effect.aggregationStrategy
            })),
            ...effects.limits.map((effect) => ({
                key: effect.key,
                value: effect.value,
                strategy: effect.aggregationStrategy
            }))
        ];
    }
    if (
        source.type === 'SUBSCRIPTION' ||
        source.type === 'COURTESY' ||
        source.type === 'BASE' ||
        (source.type === 'TRIAL' && source.since === 'NOT_STARTED')
    ) {
        if (source.reference.kind !== 'PLAN_VERSION')
            throw new UnresolvedCoverageSourceError(source.type);
        if (!(await args.reader.findPlanVersionSummary({ id: source.reference.planVersionId })))
            throw new UnresolvedCoverageSourceError(source.type);
        const effects = await args.reader.findPlanVersionEffects({
            id: source.reference.planVersionId
        });
        return [
            ...effects.entitlements.map((effect) => ({
                key: effect.key,
                value: effect.planQuota ?? Number.POSITIVE_INFINITY,
                strategy: effect.aggregationStrategy
            })),
            ...effects.limits.map((effect) => ({
                key: effect.key,
                value: effect.value,
                strategy: effect.aggregationStrategy
            }))
        ];
    }
    throw new UnresolvedCoverageSourceError(source.type);
}

/** Resolves only the user + vertical portion; LISTING deltas are separate. */
export async function resolveEffectiveSet(
    args: ResolveEffectiveSetArgs
): Promise<ResolvedEffectiveSet> {
    const coverage = await args.billing.coverage({ userId: args.userId, vertical: args.vertical });
    const sources = coverage.sources.filter((source) => source.scope !== 'LISTING');
    const foldable: FoldableSource[] = [];
    for (const source of sources) foldable.push({ source, grants: await grantsOf(args, source) });
    const folded = foldPlegableSet({ sources: foldable });
    const strategies = new Map(
        foldable.flatMap(({ grants }) =>
            grants.map(({ key, strategy }) => [key, strategy] as const)
        )
    );
    return {
        userId: args.userId,
        vertical: args.vertical,
        hasLiveNonTrialTitle: hasLiveNonTrialTitle({ sources }),
        entries: [...folded].map(([key, value]) => {
            const strategy = getCatalogKey({ key })?.aggregationStrategy ?? strategies.get(key);
            if (!strategy) throw new UnresolvedCoverageSourceError(`key:${key}`);
            return { key, value, strategy };
        })
    };
}
