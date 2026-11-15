import type { DrizzleClient } from '@repo/db';
import { eq, plans, planVersions, subscriptionScheduledChanges } from '@repo/db';
import { resolvePlanDisplayName } from '../plan-display-name.js';

/** The queued plan change a grace notice mentions (HOS-1784). */
export interface GraceNoticeScheduledChange {
    readonly planName: string;
    readonly effectiveAt: string;
}

/**
 * Reads the subscription's queued plan change (`subscription_scheduled_change`, at most one row) with
 * the destination plan's display name, inside the caller's transaction.
 */
export async function readGraceNoticeScheduledChange(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly vertical: string | null;
}): Promise<GraceNoticeScheduledChange | null> {
    const [row] = await input.tx
        .select({
            effectiveAt: subscriptionScheduledChanges.effectiveAt,
            slug: plans.slug,
            name: plans.name
        })
        .from(subscriptionScheduledChanges)
        .innerJoin(
            planVersions,
            eq(planVersions.id, subscriptionScheduledChanges.targetPlanVersionId)
        )
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
        .limit(1);
    if (!row) return null;
    return {
        planName: await resolvePlanDisplayName({
            vertical: input.vertical,
            plan: { slug: row.slug, name: row.name }
        }),
        effectiveAt: row.effectiveAt.toISOString()
    };
}
