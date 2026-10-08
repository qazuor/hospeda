/**
 * The resolution of the trial plan's effective set (HOS-1440, V3.2, AC:V3:4;
 * DEC-TRIAL-001 and DEC-TRIAL-002, `V/15` §2): derive → apply the current
 * overrides over that result → compare at the end against the floor and keep
 * the better. The override REPLACES the derived value for its key, it never
 * competes with it (`V/15` §2, DEC-TRIAL-001): the order is always the same and
 * the override never replaces the derivation itself.
 *
 * - **Derive**: from the vertical's sellable and current versions, the
 *   entitlements come from the highest-rank one and the limits from the
 *   lowest-rank one (`V/10` §2).
 * - **Overrides**: the `plan_version_limit` rows of the trial plan's current
 *   version (`V2.md:78`, Coord-22). Only its limits are overrides; an
 *   entitlement row there refuses ({@link TrialPlanEntitlementOverrideError}).
 * - **Floor**: the effective set the trial had when it started (DEC-TRIAL-002
 *   implication 4): the entitlements derive from `floor.entitlementsVersionId`
 *   and the limits from `floor.limitsVersionId`, applying the overrides of the
 *   floor trial-plan version. It is stored as references to versions, never as a
 *   copy of values.
 * - **Ratchet**: compare the current result against the floor at the end per
 *   key and keep the more favorable value, so the trial only ever raises.
 *
 * The trial quota plays no part: an entitlement's `trialQuota` is never read
 * (the entitlement's value comes from its `planQuota`, `V/15` §7), and only
 * `plan_version_limit` rows are limits.
 *
 * Every key of a version is resolved through {@link resolveKeyScope}: a vertical
 * key asks for the vertical being resolved, so it can never be read from another
 * one (AC:V3:3).
 */
import { type AggregationStrategy, getCatalogKey } from '@repo/schemas';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import { CatalogVersionNotFoundError } from '../plan-catalog/errors';
import { TrialPlanEntitlementOverrideError } from './errors';
import { bestOf } from './ratchet';
import { resolveKeyScope } from './scope';

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

/** The effective set of a trial in progress. */
export interface TrialSet {
    /** Plan quota per entitlement key (`Infinity` for a plain one). */
    readonly entitlements: ReadonlyMap<string, number>;
    /** Value per limit key. */
    readonly limits: ReadonlyMap<string, number>;
}

/** Resolves the scope of every key a version declares. */
function assertKeysResolveByVertical(args: {
    readonly effects: {
        readonly limits: readonly { readonly key: string }[];
        readonly entitlements: readonly { readonly key: string }[];
    };
    readonly vertical: string;
}): void {
    for (const key of [...args.effects.limits, ...args.effects.entitlements]) {
        const definition = getCatalogKey({ key: key.key });
        if (!definition) continue;
        resolveKeyScope({ definition, vertical: args.vertical });
    }
}

/** Reads a version's limits as a value map. */
async function limitsOf(args: {
    readonly reader: PlanCatalogReader;
    readonly versionId: string;
    readonly vertical: string;
}): Promise<Map<string, Valued>> {
    const effects = await args.reader.findPlanVersionEffects({ id: args.versionId });
    assertKeysResolveByVertical({ effects, vertical: args.vertical });
    return new Map(
        effects.limits.map((limit) => [
            limit.key,
            { value: limit.value, strategy: limit.aggregationStrategy }
        ])
    );
}

/**
 * Reads a version's entitlements as a value map. The value is the plan quota
 * (`Infinity` for a plain one); the trial quota never participates.
 */
async function entitlementsOf(args: {
    readonly reader: PlanCatalogReader;
    readonly versionId: string;
    readonly vertical: string;
}): Promise<Map<string, Valued>> {
    const effects = await args.reader.findPlanVersionEffects({ id: args.versionId });
    assertKeysResolveByVertical({ effects, vertical: args.vertical });
    return new Map(
        effects.entitlements.map((entitlement) => [
            entitlement.key,
            {
                value: entitlement.planQuota ?? Number.POSITIVE_INFINITY,
                strategy: entitlement.aggregationStrategy
            }
        ])
    );
}

/** Reads a trial plan version's limits as overrides, refusing entitlement rows. */
async function overridesOf(args: {
    readonly reader: PlanCatalogReader;
    readonly versionId: string;
    readonly vertical: string;
}): Promise<Map<string, Valued>> {
    const effects = await args.reader.findPlanVersionEffects({ id: args.versionId });
    if (effects.entitlements.length > 0) {
        throw new TrialPlanEntitlementOverrideError({ planVersionId: args.versionId });
    }
    assertKeysResolveByVertical({ effects, vertical: args.vertical });
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
    return limitsOf({ reader: args.reader, versionId: base.id, vertical: args.vertical });
}

/**
 * Derives the vertical's entitlements from its sellable and current versions:
 * the highest-rank one (`V/10` §2).
 */
async function deriveVerticalEntitlements(args: {
    readonly reader: PlanCatalogReader;
    readonly vertical: string;
}): Promise<Map<string, Valued>> {
    const versions = await args.reader.findSellableCurrentVersions({
        vertical: args.vertical
    });
    const top = versions[versions.length - 1];
    if (top === undefined) return new Map();
    return entitlementsOf({ reader: args.reader, versionId: top.id, vertical: args.vertical });
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
}): Map<string, number> {
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
 * Resolves the effective set of a trial in progress.
 *
 * @param args.reader - Reads the catalog.
 * @param args.trial - The trial's vertical, trial plan and floor references.
 * @returns The effective entitlements and limits the trial grants.
 * @throws TrialPlanEntitlementOverrideError if a trial plan version used for
 * overrides declares entitlement rows.
 * @throws CatalogVersionNotFoundError if the trial plan has no current version.
 * @throws MissingVerticalForVerticalKeyError if a version declares a vertical key
 * and the resolution carries no vertical.
 * @throws UndecidableKeyError if a key declares `BEST_DECLARED`.
 */
export async function resolveTrialSet(args: {
    readonly reader: PlanCatalogReader;
    readonly trial: TrialInProgress;
}): Promise<TrialSet> {
    const derivedEntitlements = await deriveVerticalEntitlements({
        reader: args.reader,
        vertical: args.trial.vertical
    });
    const derivedLimits = await deriveVerticalLimits({
        reader: args.reader,
        vertical: args.trial.vertical
    });

    const currentTrialPlanVersion = await args.reader.findCurrentPlanVersion({
        planId: args.trial.trialPlanId
    });
    if (!currentTrialPlanVersion) {
        // Without the current trial-plan version the overrides in force cannot be
        // read; the floor version is NOT a substitute (it is the old overrides).
        throw new CatalogVersionNotFoundError({
            kind: 'plan_version',
            id: args.trial.trialPlanId
        });
    }
    const overrides = await overridesOf({
        reader: args.reader,
        versionId: currentTrialPlanVersion.id,
        vertical: args.trial.vertical
    });

    const floorEntitlements = await entitlementsOf({
        reader: args.reader,
        versionId: args.trial.floor.entitlementsVersionId,
        vertical: args.trial.vertical
    });
    const floorDerived = await limitsOf({
        reader: args.reader,
        versionId: args.trial.floor.limitsVersionId,
        vertical: args.trial.vertical
    });
    const floorOverrides = await overridesOf({
        reader: args.reader,
        versionId: args.trial.floor.trialPlanVersionId,
        vertical: args.trial.vertical
    });

    return {
        entitlements: ratchet({
            current: derivedEntitlements,
            floor: floorEntitlements
        }),
        limits: ratchet({
            current: applyOverrides({ derived: derivedLimits, overrides }),
            floor: applyOverrides({ derived: floorDerived, overrides: floorOverrides })
        })
    };
}
