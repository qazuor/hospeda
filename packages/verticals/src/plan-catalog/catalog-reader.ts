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
 * The identity and the two catalog flags of one plan version (HOS-1440, V3.2,
 * AC:V3:3 to AC:V3:5): which plan and vertical it belongs to, its rank, and
 * whether it is sellable and current.
 *
 * The effective-set resolution reads it to derive a vertical's versions and to
 * follow a GRANT's anchored plan
 * (`V/10` §2). A version is never read "sellable or not" by the same path:
 * the derivation of the trial plan sells and requires both flags; a grant reads
 * the current version whether it is sellable or not.
 */
export interface PlanVersionSummaryRow {
    readonly id: string;
    readonly planId: string;
    readonly vertical: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
}

/**
 * One entitlement a plan version grants; a metered one carries BOTH quotas
 * (`planQuota` and `trialQuota`), set together (DB check
 * `ck_plan_version_entitlement_quotas_together`). `aggregationStrategy` is the
 * one its key declares in the catalog.
 *
 * The port transports both quotas so the resolution can tell a metered key from
 * a plain one by the key's own definition (HOS-1440, V3.2, AC:V3:3): dropping
 * `trialQuota` here would make `undefined` look metered and wrongly refuse a
 * plain global key. It is declared optional so a V2 unit fixture that predates
 * this half (out of this change's scope) still typechecks; `PlanCatalogModel`
 * and the in-memory reader always transport it, and the resolution treats a
 * missing one as "no trial quota".
 */
export interface PlanVersionEntitlementRow {
    readonly key: string;
    readonly planQuota: number | null;
    readonly trialQuota?: number | null;
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
    /**
     * The identity of one plan version, or `null` when no version has that id.
     * Used to read the vertical a source's `reference` belongs to (GRANT floor
     * by vertical, AC:V3:5).
     */
    findPlanVersionSummary(args: { readonly id: string }): Promise<PlanVersionSummaryRow | null>;
    /**
     * Every sellable and current version of a vertical, in rank order. The trial
     * plan derives from the highest-rank one for entitlements and the
     * lowest-rank one for limits (`V/10` §2, AC:V3:4).
     */
    findSellableCurrentVersions(args: {
        readonly vertical: string;
    }): Promise<readonly PlanVersionSummaryRow[]>;
    /**
     * The current version of a plan, whether it is sellable or not. A GRANT
     * follows the current version of its anchored plan even when the plan was
     * retired (AC:V3:5, `V/10` §2).
     */
    findCurrentPlanVersion(args: {
        readonly planId: string;
    }): Promise<PlanVersionSummaryRow | null>;
}
