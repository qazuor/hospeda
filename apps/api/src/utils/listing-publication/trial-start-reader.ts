import type { DrizzleClient } from '@repo/db';
import { planCatalogModel, trials } from '@repo/db';
import { TRIAL_PLAN_ROLE, VERTICAL_ACTIVATION_EVENT_BY_VERTICAL } from '@repo/schemas';
import { and, eq, sql } from 'drizzle-orm';
import type { TrialStartReader } from '../../../../../packages/verticals/src/trial/trial-start-types';

export function buildTrialStartReader({
    client
}: {
    readonly client: DrizzleClient;
}): TrialStartReader {
    return {
        async findActivationEvent({ vertical }) {
            return VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[vertical];
        },
        async findTrialPlan({ vertical }) {
            const planResult = await client.execute(sql<{ id: string }>`
                SELECT id FROM plan WHERE vertical = ${vertical} AND role = ${TRIAL_PLAN_ROLE} LIMIT 1`);
            const plan = planResult.rows[0];
            if (!plan) return null;
            const versions = await client.execute(sql<{ id: string; trialDays: number }>`
                SELECT id, trial_days AS "trialDays" FROM plan_version
                WHERE plan_id = ${plan.id} AND current = true LIMIT 1`);
            const version = versions.rows[0];
            return version
                ? {
                      planId: String(plan.id),
                      planVersionId: String(version.id),
                      trialDays: Number(version.trialDays)
                  }
                : null;
        },
        async findSellableCurrentVersions({ vertical }) {
            return planCatalogModel.findSellableCurrentVersions({ vertical, tx: client });
        },
        async findTrialOfUser({ userId, vertical }) {
            const [row] = await client
                .select()
                .from(trials)
                .where(and(eq(trials.userId, userId), eq(trials.vertical, vertical)))
                .limit(1);
            return row ? { id: row.id } : null;
        },
        async findTrialByPseudonym({ emailPseudonym, vertical }) {
            const [row] = await client
                .select({ userId: trials.userId })
                .from(trials)
                .where(
                    and(eq(trials.emailPseudonym, emailPseudonym), eq(trials.vertical, vertical))
                )
                .limit(1);
            return row ?? null;
        }
    };
}
