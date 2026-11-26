import type { CoverageSource } from '@repo/billing-verticals-contract';
import { isUnlimitedLimit, type ListingPhotoAllowance } from '@repo/schemas';
import { foldPlegableSet } from './fold';
import { selectPlegableSources } from './plegable';
import { collectFoldableSources, type ResolveEffectiveSetArgs } from './resolve-effective-set';

type PhotoLimitKey = `${ListingPhotoAllowance['limitKey']}`;
type Contribution = NonNullable<ListingPhotoAllowance['breakdown']>['contributions'][number];
type FoldedKind = Exclude<Contribution['kind'], 'PRE_TRIAL_DRAFT'>;

const KIND_BY_TYPE = {
    SUBSCRIPTION: 'PLAN',
    TRIAL: 'TRIAL',
    COURTESY: 'COURTESY',
    GRANT: 'PERMANENT_GRANT',
    ADDON: 'ADDON',
    BASE: 'BASE'
} as const satisfies Record<CoverageSource['type'], FoldedKind>;

const CONTRIBUTION_ORDER: readonly FoldedKind[] = [
    'PLAN',
    'TRIAL',
    'COURTESY',
    'PERMANENT_GRANT',
    'ADDON',
    'BASE'
];

/** The raw folded limit and its display-ready contributions for one requested key. */
export type EffectiveLimitBreakdown = {
    readonly total: number;
    readonly contributions: readonly Contribution[];
};

/** Resolves a fresh breakdown for SUM photo keys using the same coverage and fold as enforcement. */
export async function resolveEffectiveLimitBreakdown(
    args: ResolveEffectiveSetArgs & { readonly keys: readonly PhotoLimitKey[] }
): Promise<ReadonlyMap<PhotoLimitKey, EffectiveLimitBreakdown>> {
    const { foldable } = await collectFoldableSources(args);
    const folded = foldPlegableSet({ sources: foldable });
    const selected = selectPlegableSources({ sources: foldable });

    return new Map(
        args.keys.map((key) => {
            const groups = new Map<FoldedKind, { value: number; sources: number }>();
            for (const { source, grants } of selected) {
                const values = grants.filter((grant) => grant.key === key && grant.value !== 0);
                if (values.length === 0) continue;
                const kind =
                    source.type === 'TRIAL' && source.since === 'NOT_STARTED'
                        ? 'BASE'
                        : KIND_BY_TYPE[source.type];
                const previous = groups.get(kind) ?? { value: 0, sources: 0 };
                groups.set(kind, {
                    value: values.reduce((sum, grant) => sum + grant.value, previous.value),
                    sources: previous.sources + 1
                });
            }
            const contributions = CONTRIBUTION_ORDER.flatMap((kind): Contribution[] => {
                const group = groups.get(kind);
                if (!group) return [];
                return [
                    {
                        kind,
                        sources: group.sources,
                        value: isUnlimitedLimit({ value: group.value }) ? 'unlimited' : group.value
                    }
                ];
            });
            return [key, { total: folded.get(key) ?? 0, contributions }];
        })
    );
}
