/**
 * @file plan-of-version.service.ts
 * @description The catalog plan a plan version belongs to (HOS-2328): its slug
 * and stored name. Used where a coverage source points at a plan version (a
 * courtesy, a permanent grant) and the owner must see which plan it is. The name
 * is the catalog row's, never a code map (HOS-1967).
 */

import { eq, getDb, plans, planVersions } from '@repo/db';

/** The catalog plan of one plan version. */
export interface PlanOfVersion {
    /** The plan's catalog slug (the i18n key of its name). */
    readonly slug: string;
    /** The plan's stored name, the fallback when the slug has no translation. */
    readonly name: string;
}

/**
 * Reads the plan a plan version belongs to.
 *
 * @param input.planVersionId - The plan version.
 * @returns The plan's slug and name, or `null` when no version has that id.
 */
export async function readPlanOfVersion(input: {
    readonly planVersionId: string;
}): Promise<PlanOfVersion | null> {
    const [row] = await getDb()
        .select({ slug: plans.slug, name: plans.name })
        .from(planVersions)
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(planVersions.id, input.planVersionId))
        .limit(1);
    return row ?? null;
}
