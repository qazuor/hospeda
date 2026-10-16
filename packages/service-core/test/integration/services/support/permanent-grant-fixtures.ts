import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    courtesyGrants,
    type DrizzleClient,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    planCatalogModel,
    plans,
    planVersions
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { createPlanCatalogInverse } from '@repo/verticals';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb, getServiceTestPool } from '../helpers';
import { cleanUpCoverageNoticeRows } from './coverage-notice-fixtures.js';

/** Build a fixture signer actor with the complimentary grant permission. */
export function grantSignerActor(
    userId: string,
    permissions: readonly PermissionEnum[] = [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
): Actor {
    return { id: userId, roles: [RoleEnum.SUPER_ADMIN], permissions };
}

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
        readonly includesAddons?: boolean;
        readonly revoked?: boolean;
    }
): Promise<{ readonly grantId: string; readonly anchorIds: string[] }> {
    const [grant] = await tx
        .insert(permanentGrants)
        .values({
            beneficiaryUserId: input.beneficiaryUserId,
            includesAddons: input.includesAddons ?? false,
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

/** Cleans committed grant-test rows without truncating shared integration tables. */
export async function retirePermanentGrantRows(userIds: readonly string[]): Promise<void> {
    if (userIds.length === 0) return;
    const db = getServiceTestDb();
    const grants = await db
        .select({ id: permanentGrants.id })
        .from(permanentGrants)
        .where(inArray(permanentGrants.beneficiaryUserId, [...userIds]));
    const grantIds = grants.map(({ id }) => id);
    await db.delete(addonInstances).where(inArray(addonInstances.ownerId, [...userIds]));
    if (grantIds.length > 0)
        await db
            .delete(permanentGrantVerticals)
            .where(inArray(permanentGrantVerticals.permanentGrantId, grantIds));
    await db
        .delete(permanentGrants)
        .where(inArray(permanentGrants.beneficiaryUserId, [...userIds]));
    await db.delete(courtesyGrants).where(inArray(courtesyGrants.beneficiaryUserId, [...userIds]));
    await getServiceTestPool().query(
        'DELETE FROM subscription_pause WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))',
        [userIds]
    );
    await cleanUpCoverageNoticeRows({ userIds, promoCodeIds: [] });
    await getServiceTestPool().query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
}

/** Policy port for tests whose behavior does not exercise floor rejection. */
export const currentFloorPolicy: VerticalsForBilling['planPolicy'] = async () => ({
    graceDays: 0,
    allowsPause: false,
    current: true,
    sellable: false
});

/** Build the real catalog policy for integration cases that verify catalog currentness. */
export function catalogPlanPolicy(): VerticalsForBilling['planPolicy'] {
    return createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy;
}
