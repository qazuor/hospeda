import {
    type DrizzleClient,
    permanentGrants,
    permanentGrantVerticals,
    plans,
    planVersions
} from '@repo/db';

/** Inserts a plan and current floor version for one vertical. */
export async function seedGrantPlan(
    tx: DrizzleClient,
    vertical: string
): Promise<{ readonly planId: string; readonly floorPlanVersionId: string }> {
    const [plan] = await tx
        .insert(plans)
        .values({ vertical, slug: `grant-${crypto.randomUUID()}`, name: 'Grant plan' })
        .returning({ id: plans.id });
    if (!plan) throw new Error('grant fixture plan missing');
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: false,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('grant fixture floor version missing');
    return { planId: plan.id, floorPlanVersionId: version.id };
}

/** Inserts a permanent grant and its anchors through the caller's transaction. */
export async function seedPermanentGrant(
    tx: DrizzleClient,
    input: {
        readonly beneficiaryUserId: string;
        readonly grantedBy: string;
        readonly anchors: readonly { readonly vertical: string }[];
        readonly revoked?: boolean;
    }
): Promise<{ readonly grantId: string; readonly anchorIds: string[] }> {
    const [grant] = await tx
        .insert(permanentGrants)
        .values({
            beneficiaryUserId: input.beneficiaryUserId,
            includesAddons: false,
            grantedBy: input.grantedBy,
            reason: 'Coord-362 integration fixture',
            ...(input.revoked
                ? {
                      revokedAt: new Date('2026-10-01T00:00:00.000Z'),
                      revokedBy: input.grantedBy,
                      revocationReason: 'Fixture revoked grant'
                  }
                : {})
        })
        .returning({ id: permanentGrants.id });
    if (!grant) throw new Error('grant fixture row missing');

    const anchorIds: string[] = [];
    for (const anchor of input.anchors) {
        const { planId, floorPlanVersionId } = await seedGrantPlan(tx, anchor.vertical);
        const [row] = await tx
            .insert(permanentGrantVerticals)
            .values({
                permanentGrantId: grant.id,
                vertical: anchor.vertical,
                planId,
                floorPlanVersionId
            })
            .returning({ id: permanentGrantVerticals.id });
        if (!row) throw new Error('grant fixture anchor missing');
        anchorIds.push(row.id);
    }
    return { grantId: grant.id, anchorIds };
}
