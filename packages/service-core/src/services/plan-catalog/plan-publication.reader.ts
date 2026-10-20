import {
    and,
    billingOptions,
    catalogKeys,
    eq,
    inArray,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    verticals
} from '@repo/db';
import type { BillingCycle, PlanRole, PlanVersionContentInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { DrizzleClient } from '../../types';
import { ServiceError } from '../../types';
import type { CatalogPlan, PublicationContext, VersionEffects } from './plan-publication.types.js';

/**
 * The reads the action 18 service performs before validating and writing
 * (HOS-1436, piece V2, AC:V2:6/7). Every function receives and returns objects
 * (RO-RO pattern).
 */

/** Loads each key's class from the code catalog (`catalog_key`). */
export async function loadKeyClasses(input: {
    client: DrizzleClient;
    keys: readonly string[];
}): Promise<ReadonlyMap<string, string>> {
    const { client, keys } = input;
    if (keys.length === 0) return new Map();
    const rows = await client
        .select({ key: catalogKeys.key, keyClass: catalogKeys.keyClass })
        .from(catalogKeys)
        .where(inArray(catalogKeys.key, [...new Set(keys)]));
    return new Map(rows.map((row) => [row.key, row.keyClass]));
}

/** Loads the vertical catalog with each plan's current version. */
export async function loadCatalog(input: {
    client: DrizzleClient;
    vertical: string;
}): Promise<readonly CatalogPlan[]> {
    const { client, vertical } = input;
    const planRows = await client
        .select({ id: plans.id, role: plans.role })
        .from(plans)
        .where(eq(plans.vertical, vertical));
    const currentRows = await client
        .select()
        .from(planVersions)
        .where(and(eq(planVersions.vertical, vertical), eq(planVersions.current, true)));
    const byPlan = new Map(currentRows.map((row) => [row.planId, row]));
    return planRows.map((row) => ({
        id: row.id,
        role: row.role as PlanRole | null,
        currentVersion: byPlan.get(row.id) ?? null
    }));
}

/** Loads one version's entitlements and limits. */
export async function loadEffects(input: {
    client: DrizzleClient;
    versionId: string;
}): Promise<VersionEffects> {
    const { client, versionId } = input;
    const entitlements = await client
        .select({
            key: planVersionEntitlements.key,
            planQuota: planVersionEntitlements.planQuota,
            trialQuota: planVersionEntitlements.trialQuota
        })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.planVersionId, versionId));
    const limits = await client
        .select({ key: planVersionLimits.key, value: planVersionLimits.value })
        .from(planVersionLimits)
        .where(eq(planVersionLimits.planVersionId, versionId));
    return { entitlements, limits };
}

/** Reads the cycles of a version's billing options, if it declares any. */
export async function loadVersionCycles(input: {
    client: DrizzleClient;
    versionId: string;
}): Promise<{ cycles?: readonly BillingCycle[] }> {
    const { client, versionId } = input;
    const rows = await client
        .select({ cycle: billingOptions.cycle })
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, versionId));
    if (rows.length === 0) return {};
    return { cycles: rows.map((row) => row.cycle as BillingCycle) };
}

/** Assembles the publication context, running the reads the validation needs. */
export async function buildPublicationContext(input: {
    client: DrizzleClient;
    planId: string;
    content: PlanVersionContentInput;
}): Promise<PublicationContext> {
    const { client, planId, content } = input;
    const [planRow] = await client
        .select({ id: plans.id, vertical: plans.vertical, role: plans.role })
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);
    if (!planRow) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'El plan no existe');
    }
    const [verticalRow] = await client
        .select({ activationEvent: verticals.activationEvent })
        .from(verticals)
        .where(eq(verticals.id, planRow.vertical))
        .limit(1);
    const catalog = await loadCatalog({ client, vertical: planRow.vertical });
    const target = catalog.find((plan) => plan.id === planRow.id);
    const previous = target?.currentVersion ?? null;
    const keys = [
        ...content.entitlements.map((item) => item.key),
        ...content.limits.map((item) => item.key)
    ];
    const keyClasses = await loadKeyClasses({ client, keys });
    const previousCycles = previous
        ? (await loadVersionCycles({ client, versionId: previous.id })).cycles
        : undefined;
    return {
        planId: planRow.id,
        vertical: planRow.vertical,
        activationEvent: verticalRow?.activationEvent ?? null,
        role: planRow.role as PlanRole | null,
        previous,
        catalog,
        content,
        keyClasses,
        previousCycles
    };
}
