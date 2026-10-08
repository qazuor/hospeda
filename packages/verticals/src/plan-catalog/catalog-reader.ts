/**
 * The port the plan catalog's inverse queries read through (HOS-1435, V2).
 *
 * It names only the rows the three queries need. `@repo/db`'s
 * `planCatalogModel` satisfies it structurally; the composition root of
 * `apps/api` passes it in, and unit tests pass an in-memory one. Keeping the
 * port here, instead of importing the model, keeps this package's production
 * code free of the database layer.
 */
import type { AggregationStrategy } from '@repo/schemas';

/** What a plan version declares that `planPolicy` reads. */
export interface PlanVersionPolicyRow {
    readonly graceDays: number;
    readonly allowsPause: boolean;
    readonly current: boolean;
    readonly sellable: boolean;
}

/**
 * One entitlement a plan version grants; `planQuota` is set for a metered one.
 * `aggregationStrategy` is the one its key declares in the catalog.
 */
export interface PlanVersionEntitlementRow {
    readonly key: string;
    readonly planQuota: number | null;
    readonly aggregationStrategy: AggregationStrategy;
}

/** One limit a plan version sets, with the aggregation strategy its key declares. */
export interface PlanVersionLimitRow {
    readonly key: string;
    readonly value: number;
    readonly aggregationStrategy: AggregationStrategy;
}

/** What a plan version grants. */
export interface PlanVersionEffectsRow {
    readonly entitlements: readonly PlanVersionEntitlementRow[];
    readonly limits: readonly PlanVersionLimitRow[];
}

/** What an addon version declares that `addonPolicy` reads. */
export interface AddonVersionPolicyRow {
    readonly addonId: string;
    readonly validity: string;
    readonly validityDays: number | null;
    readonly scopeType: string;
}

/** Reads the plan and addon catalog. */
export interface PlanCatalogReader {
    /** One plan version, or `null` when no version has that id. */
    findPlanVersion(args: { readonly id: string }): Promise<PlanVersionPolicyRow | null>;
    /** What one plan version grants (empty lists when it grants nothing). */
    findPlanVersionEffects(args: { readonly id: string }): Promise<PlanVersionEffectsRow>;
    /** One addon version, or `null` when no addon version has that id. */
    findAddonVersion(args: { readonly id: string }): Promise<AddonVersionPolicyRow | null>;
}
