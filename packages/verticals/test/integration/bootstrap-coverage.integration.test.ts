/** TEST:V4:14 — bootstrap sources over the db:migrate database. */
import { randomUUID } from 'node:crypto';
import { type DrizzleClient, plans, planVersions, trials, users } from '@repo/db';
import {
    FLOOR_PLAN_ROLE,
    type PlanRole,
    PRE_TRIAL_PLAN_ROLE,
    TRIAL_PLAN_ROLE,
    TrialStatusEnum,
    VerticalEnum
} from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import type { BootstrapCoverageReader } from '../../src/coverage/trial-and-base-sources';
import { CatalogVersionNotFoundError } from '../../src/plan-catalog/errors';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());

class Rollback extends Error {}

async function inRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
}

const createReader = (db: DrizzleClient): BootstrapCoverageReader => ({
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
});

async function seedVersion(db: DrizzleClient, vertical: string, role: PlanRole | null) {
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            role,
            slug: randomUUID(),
            name: 'Coverage fixture'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Plan insert failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: 1_000_000,
            sellable: role === null,
            current: true,
            trialDays: 14,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Plan version insert failed');
    return { planId: plan.id, versionId: version.id };
}

async function seedUser(db: DrizzleClient) {
    const [user] = await db
        .insert(users)
        .values({
            email: `coverage-${randomUUID()}@example.com`,
            displayName: 'Coverage User'
        })
        .returning({ id: users.id, createdAt: users.createdAt });
    if (!user) throw new Error('User insert failed');
    return user;
}

describe('TEST:V4:14 migrated bootstrap coverage', () => {
    it('returns all eight fields with trial T1 and account creation instants', async () => {
        await inRollback(async (db) => {
            const subject = createBootstrapBillingForVerticals({ reader: createReader(db) });
            const vertical = VerticalEnum.GASTRONOMY;
            const user = await seedUser(db);
            const preTrial = await seedVersion(db, vertical, PRE_TRIAL_PLAN_ROLE);
            const floor = await seedVersion(db, vertical, FLOOR_PLAN_ROLE);
            const trial = await seedVersion(db, vertical, TRIAL_PLAN_ROLE);
            const sellable = await seedVersion(db, vertical, null);
            const startedAt = new Date('2025-01-02T03:04:05.000Z');
            const endsAt = new Date('2025-01-16T03:04:05.000Z');

            const before = await subject.coverage({ userId: user.id, vertical });
            expect(before).toEqual({
                covered: false,
                sources: [
                    {
                        type: 'TRIAL',
                        reference: { kind: 'PLAN_VERSION', planVersionId: preTrial.versionId },
                        scope: 'VERTICAL',
                        target: null,
                        since: 'NOT_STARTED',
                        until: 'NOT_STARTED',
                        charged: null,
                        floor: null
                    },
                    {
                        type: 'BASE',
                        reference: { kind: 'PLAN_VERSION', planVersionId: floor.versionId },
                        scope: 'VERTICAL',
                        target: null,
                        since: user.createdAt,
                        until: 'NEVER_EXPIRES',
                        charged: null,
                        floor: null
                    }
                ]
            });

            await db.insert(trials).values({
                userId: user.id,
                vertical,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                trialPlanId: trial.planId,
                floorEntitlementsVersionId: sellable.versionId,
                floorLimitsVersionId: sellable.versionId,
                floorTrialPlanVersionId: trial.versionId,
                startedAt,
                endsAt,
                emailPseudonym: randomUUID().replaceAll('-', '').padEnd(64, '0'),
                deadlinesVersion: 1
            });

            expect(await subject.coverage({ userId: user.id, vertical })).toEqual({
                covered: true,
                sources: [
                    {
                        type: 'TRIAL',
                        reference: { kind: 'PLAN_VERSION', planVersionId: trial.versionId },
                        scope: 'VERTICAL',
                        target: null,
                        since: startedAt,
                        until: endsAt,
                        charged: null,
                        floor: null
                    },
                    {
                        type: 'BASE',
                        reference: { kind: 'PLAN_VERSION', planVersionId: floor.versionId },
                        scope: 'VERTICAL',
                        target: null,
                        since: user.createdAt,
                        until: 'NEVER_EXPIRES',
                        charged: null,
                        floor: null
                    }
                ]
            });
        });
    });

    it('throws a typed error when the vertical has no floor plan version', async () => {
        await inRollback(async (db) => {
            const subject = createBootstrapBillingForVerticals({ reader: createReader(db) });
            const user = await seedUser(db);
            await expect(
                subject.coverage({ userId: user.id, vertical: VerticalEnum.EXPERIENCE })
            ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
        });
    });
});
