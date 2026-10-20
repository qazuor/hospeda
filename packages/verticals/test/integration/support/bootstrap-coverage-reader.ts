import { type DrizzleClient, plans, planVersions, trials, users } from '@repo/db';
import type { TrialStatusEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import type { BootstrapCoverageReader } from '../../../src/coverage/trial-and-base-sources';

/** Database-backed bootstrap reader copied from the V4.5 coverage integration pattern. */
export function createBootstrapCoverageReader(db: DrizzleClient): BootstrapCoverageReader {
    return {
        async findTrial({ userId, vertical }) {
            const [row] = await db
                .select()
                .from(trials)
                .where(and(eq(trials.userId, userId), eq(trials.vertical, vertical)))
                .limit(1);
            if (!row) return null;
            return {
                userId: row.userId,
                vertical: row.vertical,
                trialPlanId: row.trialPlanId,
                status: row.status as TrialStatusEnum,
                startedAt: row.startedAt,
                endsAt: row.endsAt,
                floor:
                    row.floorEntitlementsVersionId &&
                    row.floorLimitsVersionId &&
                    row.floorTrialPlanVersionId
                        ? {
                              entitlementsVersionId: row.floorEntitlementsVersionId,
                              limitsVersionId: row.floorLimitsVersionId,
                              trialPlanVersionId: row.floorTrialPlanVersionId
                          }
                        : null
            };
        },
        async findAccountCreatedAt({ userId }) {
            const [row] = await db
                .select({ createdAt: users.createdAt })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
            if (!row) throw new Error(`Account ${userId} does not exist`);
            return row.createdAt;
        },
        async findCurrentVersionByRole({ vertical, role }) {
            const [row] = await db
                .select({
                    id: planVersions.id,
                    planId: planVersions.planId,
                    vertical: planVersions.vertical,
                    rank: planVersions.rank,
                    sellable: planVersions.sellable,
                    current: planVersions.current
                })
                .from(planVersions)
                .innerJoin(plans, eq(planVersions.planId, plans.id))
                .where(
                    and(
                        eq(plans.vertical, vertical),
                        eq(plans.role, role),
                        eq(planVersions.current, true)
                    )
                )
                .limit(1);
            return row ?? null;
        }
    };
}
