/**
 * The resolution of a permanent GRANT (HOS-1440, V3.2, AC:V3:5;
 * DEC-GRANT-005, GUARD:G-R2-B): a grant is anchored to a plan per vertical,
 * reads the CURRENT version of that plan — sellable or not — follows its
 * improvements, and compares at the end against its `floor`, never granting
 * less than what the plan granted the day the grant was signed.
 *
 * Two rules make it BY VERTICAL (G-R2-B):
 *
 * - The grant source is the one of the vertical being resolved and no other:
 *   the resolution selects it with {@link selectGrantForVertical} over the
 *   coverage obtained for that `user + vertical` from billing.
 * - The plan of the source's `reference` must belong to that same vertical. A
 *   source that transports a plan of another vertical refuses
 *   ({@link GrantReferenceVerticalMismatchError}), because a single floor for a
 *   plural grant would compare Gastronomía's keys against an Alojamiento plan.
 * - The version of the source's `floor` must ALSO belong to that same vertical:
 *   the floor is read as its own summary and its `vertical` compared against the
 *   resolved one, so a floor transported from another vertical refuses instead
 *   of ratcheting this vertical's keys against a foreign plan. The guard
 *   G-R2-B reads that comparison (`grant-floor-by-vertical`).
 *
 * The floor travels in the source's `floor` field (contract §2, `piso` → `floor`)
 * and is never read from a billing table.
 *
 * Every key of a version is resolved through {@link resolveKeyScope}: a vertical
 * key asks for the vertical being resolved, so it can never be read from another
 * one (AC:V3:3). A metered key (one whose entitlement carries `planQuota` OR
 * `trialQuota`) with `scope: global` refuses here, on the real version read.
 */
import type {
    BillingForVerticals,
    CoverageArgs,
    CoverageSource
} from '@repo/billing-verticals-contract';
import { type AggregationStrategy, getCatalogKey } from '@repo/schemas';
import type { PlanCatalogReader, PlanVersionSummaryRow } from '../plan-catalog/catalog-reader';
import { CatalogVersionNotFoundError } from '../plan-catalog/errors';
import {
    GrantFloorPlanMismatchError,
    GrantReferenceVerticalMismatchError,
    GrantWithoutFloorError
} from './errors';
import { bestOf } from './ratchet';
import {
    assertMeteredKeyIsVertical,
    resolveKeyScope,
    type ScopedKeyValues,
    scopeKeyValues
} from './scope';

/** What a grant resolves: its entitlement quotas and its limits. */
export interface GrantSet {
    /** Plan quota per entitlement key (`Infinity` for a plain one). */
    readonly entitlements: ScopedKeyValues;
    /** Value per limit key. */
    readonly limits: ScopedKeyValues;
}

/**
 * The GRANT source of a `user + vertical`, or `null`. A grant is the source of
 * class TITLE of type GRANT (contract §2); the coverage the resolution reads is
 * already that of the vertical, so selecting the GRANT source here is selecting
 * the one of the vertical being resolved.
 *
 * @param args.sources - The live sources already returned for one `user + vertical`.
 * @returns The GRANT source, or `null` when the coverage carries none.
 */
export function selectGrantForVertical(args: {
    readonly sources: readonly CoverageSource[];
}): CoverageSource | null {
    return (
        args.sources.find((source) => source.type === 'GRANT' && source.scope === 'VERTICAL') ??
        null
    );
}

/** The plan version id of a source's reference, refusing an addon reference. */
function referencePlanVersionIdOf(args: {
    readonly reference: CoverageSource['reference'];
}): string {
    if (args.reference.kind !== 'PLAN_VERSION') {
        throw new CatalogVersionNotFoundError({
            kind: 'plan_version',
            id: `addon:${args.reference.addonVersionId}`
        });
    }
    return args.reference.planVersionId;
}

/** A value with the aggregation strategy its key declares. */
interface Valued {
    readonly value: number;
    readonly strategy: AggregationStrategy;
}

/** Reads a version's effects as entitlement and limit value maps. */
async function effectsOf(args: {
    readonly reader: PlanCatalogReader;
    readonly versionId: string;
    readonly vertical: string;
}): Promise<{ readonly entitlements: Map<string, Valued>; readonly limits: Map<string, Valued> }> {
    const effects = await args.reader.findPlanVersionEffects({ id: args.versionId });
    for (const entitlement of effects.entitlements) {
        const definition = getCatalogKey({ key: entitlement.key });
        if (!definition) continue;
        // The resolution asks for the vertical of every key it reads: a vertical
        // key without one cannot be resolved (AC:V3:3).
        resolveKeyScope({ definition, vertical: args.vertical });
        // A metered key is one that carries EITHER quota (AC:V3:3); both travel
        // from the effects, so a plain key is never read as metered. A reader
        // that omits `trialQuota` is treated as carrying none (the field is
        // optional only so an older V2 fixture still typechecks).
        assertMeteredKeyIsVertical({
            definition,
            isMetered: entitlement.planQuota !== null || (entitlement.trialQuota ?? null) !== null
        });
    }
    for (const limit of effects.limits) {
        const definition = getCatalogKey({ key: limit.key });
        if (!definition) continue;
        resolveKeyScope({ definition, vertical: args.vertical });
    }
    return {
        entitlements: new Map(
            effects.entitlements.map((entitlement) => [
                entitlement.key,
                {
                    value: entitlement.planQuota ?? Number.POSITIVE_INFINITY,
                    strategy: entitlement.aggregationStrategy
                }
            ])
        ),
        limits: new Map(
            effects.limits.map((limit) => [
                limit.key,
                { value: limit.value, strategy: limit.aggregationStrategy }
            ])
        )
    };
}

/** Keeps, per key, the more favorable of the current value and the floor's. */
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
 * Resolves the effective set of a GRANT of a `user + vertical`.
 *
 * @param args.reader - Reads the catalog.
 * @param args.vertical - The vertical being resolved.
 * @param args.billing - The coverage reader for the requested identity.
 * @param args.userId - The person whose grant is resolved.
 * @returns The ratcheted set, or `null` when the coverage carries no GRANT.
 * @throws GrantWithoutFloorError if the GRANT source carries no floor.
 * @throws GrantReferenceVerticalMismatchError if the reference plan OR the floor
 * version is of another vertical than the one being resolved.
 * @throws MeteredKeyGlobalScopeError if a version declares a metered key with
 * `scope: global`.
 * @throws MissingVerticalForVerticalKeyError if a version declares a vertical key
 * and the resolution carries no vertical.
 * @throws CatalogVersionNotFoundError if the reference or the floor version does
 * not exist.
 * @throws UndecidableKeyError if a key declares `BEST_DECLARED`.
 */
export async function resolveGrantSet(args: {
    readonly reader: PlanCatalogReader;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
}): Promise<GrantSet | null> {
    const coverage = await args.billing.coverage({ userId: args.userId, vertical: args.vertical });
    const grant = selectGrantForVertical({ sources: coverage.sources });
    if (!grant) return null;

    const referenceId = referencePlanVersionIdOf({ reference: grant.reference });
    const reference: PlanVersionSummaryRow | null = await args.reader.findPlanVersionSummary({
        id: referenceId
    });
    if (!reference) {
        throw new CatalogVersionNotFoundError({ kind: 'plan_version', id: referenceId });
    }
    if (reference.vertical !== args.vertical) {
        throw new GrantReferenceVerticalMismatchError({
            resolvedVertical: args.vertical,
            referenceVertical: reference.vertical
        });
    }
    if (grant.floor === null) throw new GrantWithoutFloorError();

    // The floor must be OF THIS VERTICAL too: reading its summary and comparing
    // its `vertical` is what makes a cross-vertical floor refuse instead of
    // ratcheting this vertical's keys against a foreign plan (G-R2-B).
    const floorSummary = await args.reader.findPlanVersionSummary({ id: grant.floor });
    if (!floorSummary) {
        throw new CatalogVersionNotFoundError({ kind: 'plan_version', id: grant.floor });
    }
    if (floorSummary.vertical !== args.vertical) {
        throw new GrantReferenceVerticalMismatchError({
            resolvedVertical: args.vertical,
            referenceVertical: floorSummary.vertical
        });
    }
    if (floorSummary.planId !== reference.planId) {
        throw new GrantFloorPlanMismatchError({
            referencePlanId: reference.planId,
            floorPlanId: floorSummary.planId
        });
    }

    const currentVersion = await args.reader.findCurrentPlanVersion({
        planId: reference.planId
    });
    if (!currentVersion) {
        throw new CatalogVersionNotFoundError({ kind: 'plan_version', id: reference.planId });
    }

    const current = await effectsOf({
        reader: args.reader,
        versionId: currentVersion.id,
        vertical: args.vertical
    });
    const floor = await effectsOf({
        reader: args.reader,
        versionId: grant.floor,
        vertical: args.vertical
    });
    return {
        entitlements: scopeKeyValues({
            values: ratchet({ current: current.entitlements, floor: floor.entitlements }),
            userId: args.userId,
            vertical: args.vertical
        }),
        limits: scopeKeyValues({
            values: ratchet({ current: current.limits, floor: floor.limits }),
            userId: args.userId,
            vertical: args.vertical
        })
    };
}
