/**
 * An in-memory {@link PlanCatalogReader} for unit tests: versions are stored
 * as full catalog rows (policy, trial days, effects with both quotas), so a
 * test can see that the queries pick only what they may return.
 */
import { randomUUID } from 'node:crypto';
import { type AggregationStrategy, getCatalogKey } from '@repo/schemas';
import type {
    AddonVersionPolicyRow,
    PlanCatalogReader,
    PlanVersionEffectsRow,
    PlanVersionPolicyRow
} from '../../src/plan-catalog/catalog-reader';

/** A whole plan version row, as the catalog holds it. */
export interface StoredPlanVersion extends PlanVersionPolicyRow {
    readonly rank: number;
    readonly trialDays: number;
    readonly inheritsTouristVip: boolean;
    /** The plan the version belongs to; defaults to a fresh id per stored row. */
    readonly planId?: string;
    /** The vertical the version sells in; defaults to `accommodation`. */
    readonly vertical?: string;
    readonly entitlements: readonly {
        readonly key: string;
        readonly planQuota: number | null;
        readonly trialQuota: number | null;
        readonly aggregationStrategy: AggregationStrategy;
    }[];
    readonly limits: readonly {
        readonly key: string;
        readonly value: number;
        readonly aggregationStrategy: AggregationStrategy;
    }[];
}

/** A whole addon version row, with what it grants. */
export interface StoredAddonVersion extends AddonVersionPolicyRow {
    readonly entitlements: readonly { readonly key: string }[];
    readonly limits: readonly { readonly key: string; readonly value: number }[];
}

/** The reader plus the arrange methods that fill it. */
export interface InMemoryCatalog {
    readonly reader: PlanCatalogReader;
    readonly addPlanVersion: (row: StoredPlanVersion) => string;
    readonly addAddonVersion: (row: StoredAddonVersion) => string;
}

/** Builds an empty in-memory catalog. */
export function createInMemoryCatalog(): InMemoryCatalog {
    const planVersions = new Map<string, StoredPlanVersion & { readonly id: string }>();
    const addonVersions = new Map<string, StoredAddonVersion>();

    const reader: PlanCatalogReader = {
        async findPlanVersion({ id }) {
            return planVersions.get(id) ?? null;
        },
        async findPlanVersionEffects({ id }): Promise<PlanVersionEffectsRow> {
            const version = planVersions.get(id);
            return {
                entitlements: version?.entitlements ?? [],
                limits: version?.limits ?? []
            };
        },
        async findAddonVersion({ id }) {
            return addonVersions.get(id) ?? null;
        },
        async findAddonVersionEffects({ id }) {
            const version = addonVersions.get(id);
            const strategyOf = (key: string) => {
                const definition = getCatalogKey({ key });
                if (!definition) throw new Error(`Unknown catalog key: ${key}`);
                return definition.aggregationStrategy;
            };
            return {
                entitlements: (version?.entitlements ?? []).map(({ key }) => ({
                    key,
                    aggregationStrategy: strategyOf(key)
                })),
                limits: (version?.limits ?? []).map(({ key, value }) => ({
                    key,
                    value,
                    aggregationStrategy: strategyOf(key)
                }))
            };
        },
        async findPlanVersionSummary({ id }) {
            const version = planVersions.get(id);
            if (!version) return null;
            return {
                id: version.id,
                planId: version.planId ?? version.id,
                vertical: version.vertical ?? 'accommodation',
                rank: version.rank,
                sellable: version.sellable,
                current: version.current
            };
        },
        async findSellableCurrentVersions({ vertical }) {
            return [...planVersions.values()]
                .filter(
                    (version) =>
                        (version.vertical ?? 'accommodation') === vertical &&
                        version.sellable &&
                        version.current
                )
                .sort((a, b) => a.rank - b.rank)
                .map((version) => ({
                    id: version.id,
                    planId: version.planId ?? version.id,
                    vertical: version.vertical ?? 'accommodation',
                    rank: version.rank,
                    sellable: version.sellable,
                    current: version.current
                }));
        },
        async findCurrentPlanVersion({ planId }) {
            const version = [...planVersions.values()].find(
                (candidate) => (candidate.planId ?? candidate.id) === planId && candidate.current
            );
            if (!version) return null;
            return {
                id: version.id,
                planId: version.planId ?? version.id,
                vertical: version.vertical ?? 'accommodation',
                rank: version.rank,
                sellable: version.sellable,
                current: version.current
            };
        }
    };

    return {
        reader,
        addPlanVersion(row) {
            const id = randomUUID();
            planVersions.set(id, { ...row, id });
            return id;
        },
        addAddonVersion(row) {
            const id = randomUUID();
            addonVersions.set(id, row);
            return id;
        }
    };
}

/** A plan version with every field set, overridable. */
export function planVersionRow(overrides: Partial<StoredPlanVersion> = {}): StoredPlanVersion {
    return {
        rank: 20,
        sellable: true,
        current: true,
        graceDays: 10,
        trialDays: 14,
        allowsPause: true,
        inheritsTouristVip: false,
        entitlements: [],
        limits: [],
        ...overrides
    };
}
