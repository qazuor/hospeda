/**
 * The resolution of the trial plan's limits (HOS-1440, V3.2, AC:V3:4;
 * DEC-TRIAL-001 and DEC-TRIAL-002, `V/15` §2): derive → apply the current
 * overrides over that result → compare at the end against the floor and keep
 * the better. The override REPLACES the derived value for its key, it never
 * competes with it (`V/15` §2, DEC-TRIAL-001): the order is always the same and
 * the override never replaces the derivation itself.
 *
 * - **Derive**: from the vertical's sellable and current versions, the limits
 *   come from the lowest-rank one (`V/10` §2).
 * - **Overrides**: the `plan_version_limit` rows of the trial plan's current
 *   version (`V2.md:78`, Coord-22). Only its limits are overrides; an
 *   entitlement row there refuses ({@link TrialPlanEntitlementOverrideError}).
 * - **Floor**: the effective limits the trial had when it started
 *   (DEC-TRIAL-002 implication 4): derive from the two floor version references
 *   and apply the overrides of the floor trial-plan version. It is stored as
 *   references to versions, never as a copy of values.
 * - **Ratchet**: compare the current result against the floor at the end per
 *   key and keep the more favorable value, so the trial only ever raises.
 *
 * The trial quota plays no part: only `plan_version_limit` rows are read, and a
 * metered entitlement's `trialQuota` is never a limit (`V/15` §7).
 */
import type { AggregationStrategy } from '@repo/schemas';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import { TrialPlanEntitlementOverrideError } from './errors';
import { bestOf } from './ratchet';

/** A value with the aggregation strategy its key declares. */
interface Valued {
    readonly value: number;
    readonly strategy: AggregationStrategy;
}

/** The three floor references the `trial` table keeps (Coord-15). */
export interface TrialFloorReferences {
    readonly entitlementsVersionId: string;
    readonly limitsVersionId: string;
    readonly trialPlanVersionId: string;
}

/** A trial in progress: its vertical, its trial plan and its floor references. */
export interface TrialInProgress {
    readonly vertical: string;
    readonly trialPlanId: string;
    readonly floor: TrialFloorReferences;
}

/** One key's value, with it being a limit. */
type LimitMap = ReadonlyMap<string, number>;

/** Reads a version's limits as a value map. */
async function limitsOf(args: {
    readonly reader: PlanCatalogReader;
    readonly versionId: string;
}): Promise<Map<string, Valued>> {
    const effects = await args.reader.findPlanVersionEffects({ id: args.versionId });
    return new Map(
        effects.limits.map((limit) => [
            limit.key,
            { value: limit.value, strategy: limit.aggregationStrategy }
        ])
    );
}

/**
 * Derives the vertical's limits from its sellable and current versions: the
 * lowest-rank one (`V/10` §2).
 */
async function deriveVerticalLimits(args: {
    readonly reader: PlanCatalogReader;
    readonly vertical: string;
}): Promise<Map<string, Valued>> {
    const versions = await args.reader.findSellableCurrentVersions({
        vertical: args.vertical
    });
    const base = versions[0];
    if (base === undefined) return new Map();
    return limitsOf({ reader: args.reader, versionId: base.id });
}

/** Applies overrides over a derived map: each override replaces its key's value. */
function applyOverrides(args: {
    readonly derived: ReadonlyMap<string, Valued>;
    readonly overrides: ReadonlyMap<string, Valued>;
}): Map<string, Valued> {
    const result = new Map(args.derived);
    for (const [key, override] of args.overrides) result.set(key, override);
    return result;
}

/** Keeps, per key, the more favorable of the current result and the floor. */
function ratchet(args: {
    readonly current: ReadonlyMap<string, Valued>;
    readonly floor: ReadonlyMap<string, Valued>;
}): LimitMap {
    const result = new Map<string, number>();
    for (const [key, value] of args.current) result.set(key, value.value);
    for (const [key, floorValue] of args.floor) {
        const currentValue = args.current.get(key);
        result.set(
            key,
            currentValue === undefined
                ? floorValue.value
                : bestOf({
                      key,
                      strategy: currentValue.strategy,
                      a: currentValue.value,
                      b: floorValue.value
                  })
        );
    }
    return result;
}

/**
 * Resolves the limits of a trial in progress.
 *
 * @param args.reader - Reads the catalog.
 * @param args.trial - The trial's vertical, trial plan and floor references.
 * @returns The effective value of each limit the trial grants.
 * @throws TrialPlanEntitlementOverrideError if a trial plan version used for
 * overrides declares entitlement rows.
 * @throws UndecidableKeyError if a limit declares `BEST_DECLARED`.
 */
export async function resolveTrialLimits(args: {
    readonly reader: PlanCatalogReader;
    readonly trial: TrialInProgress;
}): Promise<LimitMap> {
    const derived = await deriveVerticalLimits({
        reader: args.reader,
        vertical: args.trial.vertical
    });

    const currentTrialPlanVersion = await args.reader.findCurrentPlanVersion({
        planId: args.trial.trialPlanId
    });
    const overrides = await overridesOf({
        reader: args.reader,
        versionId: currentTrialPlanVersion?.id ?? args.trial.floor.trialPlanVersionId
    });

    const floorDerived = await limitsOf({
        reader: args.reader,
        versionId: args.trial.floor.limitsVersionId
    });
    const floorOverrides = await overridesOf({
        reader: args.reader,
        versionId: args.trial.floor.trialPlanVersionId
    });

    return ratchet({
        current: applyOverrides({ derived, overrides }),
        floor: applyOverrides({ derived: floorDerived, overrides: floorOverrides })
    });
}

/** Reads a trial plan version's limits as overrides, refusing entitlement rows. */
async function overridesOf(args: {
    readonly reader: PlanCatalogReader;
    readonly versionId: string;
}): Promise<Map<string, Valued>> {
    const effects = await args.reader.findPlanVersionEffects({ id: args.versionId });
    if (effects.entitlements.length > 0) {
        throw new TrialPlanEntitlementOverrideError({ planVersionId: args.versionId });
    }
    return new Map(
        effects.limits.map((limit) => [
            limit.key,
            { value: limit.value, strategy: limit.aggregationStrategy }
        ])
    );
}
