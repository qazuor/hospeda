/**
 * Reads the plan a live permanent grant anchors in one vertical (HOS-2665).
 *
 * It is the same live-anchor predicate as `resolveGrantSources` (an unrevoked
 * grant of the beneficiary, anchored in the requested vertical), plus the
 * anchor's plan identity and its catalog display name. The pricing situation
 * reads it to tell a grant holder which plan they hold, and S1 reads it to
 * refuse a checkout for the plan the person already holds for free.
 */
import {
    and,
    type DrizzleClient,
    eq,
    getDb,
    isNull,
    permanentGrants,
    permanentGrantVerticals,
    plans
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';

/** The plan a live permanent grant anchors in one vertical. */
export interface LivePermanentGrantPlan {
    /** The anchored plan, stable across catalog versions. */
    readonly planId: string;
    /** The anchor's floor version, which belongs to `planId`. */
    readonly planVersionId: string;
    /** The plan's display name, read from the catalog row. */
    readonly planName: string;
    /** When the anchor for this vertical was created. */
    readonly since: Date;
}

const inputSchema = z.strictObject({
    userId: z.uuid(),
    vertical: z.string().min(1),
    tx: z.custom<DrizzleClient>().optional()
});

/**
 * Resolves the live permanent grant plan of one `(user, vertical)`.
 *
 * @param input.userId - The grant beneficiary
 * @param input.vertical - The vertical whose anchor is read
 * @param input.tx - Optional transaction the read runs in
 * @returns `{ plan }`, `null` when no live grant anchors that vertical
 */
export async function readLivePermanentGrantPlan(input: {
    readonly userId: string;
    readonly vertical: string;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly plan: LivePermanentGrantPlan | null }> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid permanent grant plan input',
            parsed.error.issues,
            'INVALID_PERMANENT_GRANT_PLAN_INPUT'
        );
    }
    const db = input.tx ?? getDb();
    const [row] = await db
        .select({
            planId: permanentGrantVerticals.planId,
            planVersionId: permanentGrantVerticals.floorPlanVersionId,
            planName: plans.name,
            since: permanentGrantVerticals.createdAt
        })
        .from(permanentGrantVerticals)
        .innerJoin(
            permanentGrants,
            eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
        )
        .innerJoin(plans, eq(plans.id, permanentGrantVerticals.planId))
        .where(
            and(
                eq(permanentGrants.beneficiaryUserId, input.userId),
                eq(permanentGrantVerticals.vertical, input.vertical),
                isNull(permanentGrants.revokedAt)
            )
        )
        .limit(1);
    return { plan: row ?? null };
}
