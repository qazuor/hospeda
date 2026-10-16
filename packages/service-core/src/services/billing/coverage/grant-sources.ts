/**
 * The `GRANT` source of billing's real `coverage()` (contract §2.6–§2.8;
 * AC:B9a:12): one source for each live grant anchor in the requested vertical.
 * The anchor's floor is both the plan reference and the source floor.
 */
import type { CoverageArgs, CoverageSource } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    isNull,
    permanentGrantVerticals,
    permanentGrants,
    type DrizzleClient
} from '@repo/db';

/**
 * Resolves the live permanent grant source for one `(user, vertical)`.
 *
 * Reads the permanent grant's anchor for this vertical and emits the anchor's
 * floor version as both `reference` and `floor`. Revoked grants and anchors
 * for other verticals do not produce a source.
 *
 * @param args.userId - The grant beneficiary
 * @param args.vertical - The vertical whose anchor is read
 * @param args.tx - Optional transaction every read runs in
 * @returns `{ sources }`
 */
export async function resolveGrantSources(args: {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
    readonly tx?: DrizzleClient;
}): Promise<{ readonly sources: CoverageSource[] }> {
    const db = args.tx ?? getDb();
    const rows = await db
        .select({
            floorPlanVersionId: permanentGrantVerticals.floorPlanVersionId,
            createdAt: permanentGrantVerticals.createdAt
        })
        .from(permanentGrantVerticals)
        .innerJoin(
            permanentGrants,
            eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
        )
        .where(
            and(
                eq(permanentGrants.beneficiaryUserId, args.userId),
                eq(permanentGrantVerticals.vertical, args.vertical),
                isNull(permanentGrants.revokedAt)
            )
        );
    return {
        sources: rows.map((row) => ({
            type: 'GRANT',
            reference: { kind: 'PLAN_VERSION', planVersionId: row.floorPlanVersionId },
            scope: 'VERTICAL',
            target: null,
            since: row.createdAt,
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: row.floorPlanVersionId
        }))
    };
}
