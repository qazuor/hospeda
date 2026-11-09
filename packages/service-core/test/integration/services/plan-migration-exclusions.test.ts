import {
    billingDeadlineVersions,
    desc,
    eq,
    planMigrationSubscriptions,
    planMigrations
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { changeBillingDeadline } from '../../../src/services/billing/deadlines/billing-deadlines.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';

afterEach(cleanupPlanMigrationCases);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:2 AC:B12:2 la acción 17 y su previsualización',
    () => {
        it('shows a customer already in a live migration as excluded without rejecting the preview', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const db = getServiceTestDb();
            const [deadline] = await db
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!deadline) throw new Error('Deadline fixture missing');
            // Migration rows are seeded because the real launch writer belongs to c3.
            const [migration] = await db
                .insert(planMigrations)
                .values({
                    sourcePlanVersionId: seeded.planVersionId,
                    targetPlanVersionId: seeded.targetPlanVersionId,
                    vertical: 'accommodation',
                    reason: 'RETIREMENT',
                    announcedAt: migrationClock.now(),
                    noticeDays: deadline.values['12'].noticeDays,
                    deadlineVersion: deadline.version,
                    signedBy: seeded.actor.id
                })
                .returning();
            if (!migration) throw new Error('Migration fixture missing');
            const [participation] = await db
                .insert(planMigrationSubscriptions)
                .values({
                    planMigrationId: migration.id,
                    subscriptionId: seeded.predecessor.id,
                    applicationDate: new Date('2027-01-01T13:00:00Z'),
                    status: 'PARA_RESOLVER'
                })
                .returning();
            try {
                const preview = await previewPlanMigration({
                    actor: seeded.actor,
                    input: {
                        sourcePlanVersionId: seeded.planVersionId,
                        targetPlanVersionId: seeded.targetPlanVersionId
                    },
                    verticals: seeded.verticals,
                    clock: migrationClock
                });
                expect(
                    preview.rows.map((row) => ({
                        subscriptionId: row.subscriptionId,
                        direction: row.direction,
                        outcome: row.outcome,
                        excludedReason: row.excludedReason
                    }))
                ).toEqual([
                    {
                        subscriptionId: seeded.predecessor.id,
                        direction: null,
                        outcome: 'EXCLUDED',
                        excludedReason: 'ALREADY_IN_MIGRATION'
                    }
                ]);
                expect(preview.launchable).toBe(false);
            } finally {
                if (participation)
                    await db
                        .delete(planMigrationSubscriptions)
                        .where(eq(planMigrationSubscriptions.id, participation.id));
                await db.delete(planMigrations).where(eq(planMigrations.id, migration.id));
            }
        });
        it('does not write migration rows and reads the currently published deadline version', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const current = await getServiceTestDb()
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            const base = current[0];
            if (!base) throw new Error('Billing deadline baseline missing');
            const beforeMigrations = await getServiceTestDb()
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.sourcePlanVersionId, seeded.planVersionId));
            const beforeRows = await getServiceTestDb()
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            expect(beforeMigrations).toHaveLength(0);
            expect(beforeRows).toHaveLength(0);
            await changeBillingDeadline({
                actor: seeded.actor,
                key: 12,
                value: { noticeDays: 90, contactDays: [30, 7] },
                expectedVersion: base.version,
                confirmed: true
            });
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input: {
                    sourcePlanVersionId: seeded.planVersionId,
                    targetPlanVersionId: seeded.targetPlanVersionId
                },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(preview).toMatchObject({ noticeDays: 90, deadlineVersion: base.version + 1 });
            const migrations = await getServiceTestDb()
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.sourcePlanVersionId, seeded.planVersionId));
            expect(migrations).toHaveLength(0);
            const migrationRows = await getServiceTestDb()
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            expect(migrationRows).toHaveLength(0);
        });

        it('excludes the actor subscription and still offers the other customer for launch', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const preview = await previewPlanMigration({
                actor: { ...seeded.actor, id: seeded.user.id },
                input: {
                    sourcePlanVersionId: seeded.planVersionId,
                    targetPlanVersionId: seeded.targetPlanVersionId
                },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(
                preview.rows.map((row) => ({
                    subscriptionId: row.subscriptionId,
                    direction: row.direction,
                    outcome: row.outcome,
                    excludedReason: row.excludedReason
                }))
            ).toEqual(
                [
                    {
                        subscriptionId: seeded.predecessor.id,
                        direction: null,
                        outcome: 'EXCLUDED',
                        excludedReason: 'ACTOR_IS_SUBJECT'
                    },
                    {
                        subscriptionId: seeded.pendingCustomer.subscriptionId,
                        direction: 'UP',
                        outcome: 'PENDIENTE',
                        excludedReason: null
                    }
                ].sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
            );
            expect(preview.launchable).toBe(true);
        });
    }
);
