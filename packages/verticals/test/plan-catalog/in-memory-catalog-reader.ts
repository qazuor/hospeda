/**
 * An in-memory {@link PlanCatalogReader} for unit tests: versions are stored
 * as full catalog rows (policy, trial days, effects with both quotas), so a
 * test can see that the queries pick only what they may return.
 */
import { randomUUID } from 'node:crypto';
import type { AggregationStrategy } from '@repo/schemas';
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
    const planVersions = new Map<string, StoredPlanVersion>();
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
        }
    };

    return {
        reader,
        addPlanVersion(row) {
            const id = randomUUID();
            planVersions.set(id, row);
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
