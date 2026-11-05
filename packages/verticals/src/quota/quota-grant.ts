import { coverageSourceClassOf } from '@repo/billing-verticals-contract';
import { foldPlegableSet } from '../effective-set/fold';
import type { FoldableSource } from '../effective-set/types';

export interface QuotaGrant {
    readonly quota: number;
    readonly anchor: Date;
}

/**
 * Folds the current quota, then chooses the start of the oldest live title.
 * A TRIAL superseded by a subscription (HOS-2027) is discarded from the quota
 * fold but still anchors: the window keeps the trial's start (V3:10 g).
 */
export function selectQuotaGrant(input: {
    readonly key: string;
    readonly sources: readonly FoldableSource[];
}): QuotaGrant | null {
    const quota = foldPlegableSet({ sources: input.sources }).get(input.key);
    if (quota === undefined || !Number.isFinite(quota)) return null;

    const anchors: { sourceClass: 'TITLE' | 'BASE'; since: Date }[] = [];
    for (const { source, grants } of input.sources) {
        if (!(source.since instanceof Date)) continue;
        if (!grants.some((grant) => grant.key === input.key && Number.isFinite(grant.value)))
            continue;
        const { sourceClass } = coverageSourceClassOf({ source });
        if (sourceClass === 'TITLE' || sourceClass === 'BASE') {
            anchors.push({ sourceClass, since: source.since });
        }
    }
    const titles = anchors.filter((entry) => entry.sourceClass === 'TITLE');
    const eligible = titles.length > 0 ? titles : anchors;
    const first = eligible[0];
    if (!first) return null;
    const anchor = eligible.reduce(
        (earliest, entry) => (entry.since < earliest ? entry.since : earliest),
        first.since
    );
    return { quota, anchor };
}
