import {
    billingDeadlineVersions,
    type DrizzleClient,
    eq,
    inArray,
    planCatalogModel,
    planMigrationSubscriptions,
    planMigrations,
    setDb,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { changeBillingDeadline } from '../../../src/services/billing/deadlines/billing-deadlines.service.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { createSystemActor } from '../../../src/utils/system-actor.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';

const migrationIds: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupPlanMigrationCases();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

async function previewAndLaunch(
    seeded: Awaited<ReturnType<typeof createPlanMigrationCase>>,
    actor = seeded.actor
) {
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId
    };
    const preview = await previewPlanMigration({
        actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const launched = await launchPlanMigration({
        actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    return { preview, launched };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:2 AC:B12:2 la migración guarda la versión de plazos con que se anunció',
    () => {
        it('stores the current deadline version and notice days even after a later deadline publication', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { preview, launched } = await previewAndLaunch(seeded);
            const db = getServiceTestDb();
            const [stored] = await db
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.id, launched.planMigrationId));
            expect(stored).toEqual({
                id: launched.planMigrationId,
                vertical: 'accommodation',
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId,
                reason: 'RETIREMENT',
                announcedAt: migrationClock.now(),
                noticeDays: preview.noticeDays,
                deadlineVersion: preview.deadlineVersion,
                signedBy: seeded.actor.id,
                cancelledAt: null,
                cancelledBy: null,
                createdAt: expect.any(Date)
            });
            expect(launched.deadlineVersion).toBe(preview.deadlineVersion);
            expect(launched.noticeDays).toBe(preview.noticeDays);
            const laterCase = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: laterCase.actor,
                planVersionId: laterCase.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            // The deadline table is immutable. Publish through the real service inside a rolled-back test transaction.
            const rollback = new Error('rollback test deadline publication');
            try {
                await db.transaction(async (tx) => {
                    setDb(tx as unknown as DrizzleClient);
                    try {
                        const [current] = await tx
                            .select()
                            .from(billingDeadlineVersions)
                            .where(eq(billingDeadlineVersions.version, preview.deadlineVersion));
                        if (!current) throw new Error('Current deadline fixture missing');
                        const changed = await changeBillingDeadline({
                            actor: seeded.actor,
                            key: 12,
                            value: { ...current.values['12'], noticeDays: preview.noticeDays + 30 },
                            expectedVersion: preview.deadlineVersion,
                            confirmed: true
                        });
                        expect(changed.version).toBe(preview.deadlineVersion + 1);
                        const { launched: laterLaunch } = await previewAndLaunch(laterCase);
                        const [laterStored] = await tx
                            .select()
                            .from(planMigrations)
                            .where(eq(planMigrations.id, laterLaunch.planMigrationId));
                        expect({
                            deadlineVersion: laterStored?.deadlineVersion,
                            noticeDays: laterStored?.noticeDays
                        }).toEqual({
                            deadlineVersion: changed.version,
                            noticeDays: changed.values['12'].noticeDays
                        });
                        const [reloaded] = await tx
                            .select()
                            .from(planMigrations)
                            .where(eq(planMigrations.id, launched.planMigrationId));
                        expect({
                            deadlineVersion: reloaded?.deadlineVersion,
                            noticeDays: reloaded?.noticeDays
                        }).toEqual({
                            deadlineVersion: preview.deadlineVersion,
                            noticeDays: preview.noticeDays
                        });
                    } finally {
                        setDb(db);
                    }
                    throw rollback;
                });
            } catch (error) {
                if (error !== rollback) throw error;
            }
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'AC:B12:2 la acción 17 escribe una fila por cliente alcanzado',
    () => {
        it('writes exactly the previewed customers and leaves their subscription fields and scheduled changes intact', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const db = getServiceTestDb();
            const ids = [seeded.predecessor.id, seeded.pendingCustomer.subscriptionId];
            const before = await db
                .select({
                    id: subscriptions.id,
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId,
                    status: subscriptions.status,
                    nextChargeAt: subscriptions.nextChargeAt
                })
                .from(subscriptions)
                .where(inArray(subscriptions.id, ids));
            const { preview, launched } = await previewAndLaunch(seeded);
            const stored = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
            expect(
                stored
                    .map((row) => ({
                        subscriptionId: row.subscriptionId,
                        status: row.status,
                        applicationDate: row.applicationDate.toISOString().slice(0, 10),
                        outReason: row.outReason,
                        appliedAt: row.appliedAt
                    }))
                    .sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
            ).toEqual(
                preview.rows
                    .filter((row) => row.outcome !== 'EXCLUDED')
                    .map((row) => ({
                        subscriptionId: row.subscriptionId,
                        status: row.outcome,
                        applicationDate: row.applicationDate,
                        outReason: null,
                        appliedAt: null
                    }))
                    .sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
            );
            expect(launched.rows).toEqual(
                preview.rows
                    .filter((row) => row.outcome !== 'EXCLUDED')
                    .map((row) => ({
                        subscriptionId: row.subscriptionId,
                        outcome: row.outcome,
                        applicationDate: row.applicationDate
                    }))
            );
            const after = await db
                .select({
                    id: subscriptions.id,
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId,
                    status: subscriptions.status,
                    nextChargeAt: subscriptions.nextChargeAt
                })
                .from(subscriptions)
                .where(inArray(subscriptions.id, ids));
            expect(after.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
                before.sort((a, b) => a.id.localeCompare(b.id))
            );
            const scheduled = await db
                .select({ id: subscriptionScheduledChanges.id })
                .from(subscriptionScheduledChanges)
                .where(inArray(subscriptionScheduledChanges.subscriptionId, ids));
            expect(scheduled).toHaveLength(0);
        });

        it('excludes the actor account and writes the other customer', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const actor = { ...seeded.actor, id: seeded.user.id };
            const { launched } = await previewAndLaunch(seeded, actor);
            const db = getServiceTestDb();
            const ownRows = await db
                .select({ id: planMigrationSubscriptions.id })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            expect(ownRows).toHaveLength(0);
            expect(launched.excluded).toEqual([
                { subscriptionId: seeded.predecessor.id, excludedReason: 'ACTOR_IS_SUBJECT' }
            ]);
            expect(launched.rows.map((row) => row.subscriptionId)).toEqual([
                seeded.pendingCustomer.subscriptionId
            ]);
        });

        it('records PARA_RESOLVER when the destination has no matching cycle', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            const { preview, launched } = await previewAndLaunch(seeded);
            expect(preview.rows.map((row) => row.outcome)).toEqual(['PARA_RESOLVER']);
            const rows = await getServiceTestDb()
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
            expect(
                rows.map((row) => ({
                    status: row.status,
                    applicationDate: row.applicationDate.toISOString().slice(0, 10)
                }))
            ).toEqual([
                { status: 'PARA_RESOLVER', applicationDate: launched.rows[0]?.applicationDate }
            ]);
        });

        it('rejects a changed cohort and writes zero migration rows', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const input = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId
            };
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input,
                verticals: seeded.verticals,
                clock: migrationClock
            });
            // The fixture starts a second subscription through startSubscription.
            const { startCyclePriceCustomer } = await import('./support/cycle-price-fixtures.js');
            const added = await startCyclePriceCustomer(seeded.predecessorBillingOptionId);
            try {
                await expect(
                    launchPlanMigration({
                        actor: seeded.actor,
                        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
                        verticals: seeded.verticals,
                        clock: migrationClock
                    })
                ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_COHORT_CHANGED' });
                const rows = await getServiceTestDb()
                    .select({ id: planMigrations.id })
                    .from(planMigrations)
                    .where(eq(planMigrations.sourcePlanVersionId, seeded.planVersionId));
                expect(rows).toHaveLength(0);
            } finally {
                // The extra customer is not owned by createPlanMigrationCase.
                const { providerLinks, users } = await import('@repo/db');
                const db = getServiceTestDb();
                const [customer] = await db
                    .select({ userId: subscriptions.userId })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, added.subscriptionId));
                await db
                    .delete(providerLinks)
                    .where(eq(providerLinks.subscriptionId, added.subscriptionId));
                await db.delete(subscriptions).where(eq(subscriptions.id, added.subscriptionId));
                if (customer?.userId) await db.delete(users).where(eq(users.id, customer.userId));
            }
        });

        it('excludes customers in a live migration and rejects an all-excluded second launch', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            await previewAndLaunch(seeded);
            const input = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId
            };
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input,
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(
                preview.rows.map((row) => ({
                    outcome: row.outcome,
                    excludedReason: row.excludedReason
                }))
            ).toEqual([{ outcome: 'EXCLUDED', excludedReason: 'ALREADY_IN_MIGRATION' }]);
            await expect(
                launchPlanMigration({
                    actor: seeded.actor,
                    input: { ...input, cohortFingerprint: preview.cohortFingerprint },
                    verticals: seeded.verticals,
                    clock: migrationClock
                })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_EMPTY_COHORT' });
        });

        it('rejects an unauthorized or system actor before any database read or transaction', async () => {
            const seeded = await createPlanMigrationCase();
            const db = getServiceTestDb();
            const transaction = vi.spyOn(db, 'transaction');
            const read = vi.spyOn(planCatalogModel, 'findPlanVersionSummary');
            const input = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId,
                cohortFingerprint: 'a'.repeat(64)
            };
            for (const actor of [
                { ...seeded.actor, permissions: [] },
                createSystemActor({ jobId: 'migration-test', permissions: [] })
            ]) {
                await expect(
                    launchPlanMigration({ actor, input, verticals: seeded.verticals })
                ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            }
            expect(read).toHaveBeenCalledTimes(0);
            expect(transaction).toHaveBeenCalledTimes(0);
        });

        it('serializes two confirmations of the same fingerprint behind the cohort row lock', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const input = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId
            };
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input,
                verticals: seeded.verticals,
                clock: migrationClock
            });
            const launch = () =>
                launchPlanMigration({
                    actor: seeded.actor,
                    input: { ...input, cohortFingerprint: preview.cohortFingerprint },
                    verticals: seeded.verticals,
                    clock: migrationClock
                });
            const blocker = await getServiceTestPool().connect();
            let first: Promise<Awaited<ReturnType<typeof launch>>> | undefined;
            let second: Promise<Awaited<ReturnType<typeof launch>>> | undefined;
            try {
                await blocker.query('BEGIN');
                await blocker.query('SELECT id FROM subscription WHERE id = $1 FOR UPDATE', [
                    seeded.predecessor.id
                ]);
                const waitForBlocked = async (count: number) => {
                    for (let attempt = 0; attempt < 150; attempt++) {
                        const result = await getServiceTestPool().query<{ count: string }>(
                            `SELECT count(*)::text AS count FROM pg_stat_activity
                             WHERE datname = current_database() AND wait_event_type = 'Lock'
                               AND query LIKE '%subscription%' AND query LIKE '%for update%'`
                        );
                        if (Number(result.rows[0]?.count) >= count) return;
                        await new Promise((resolve) => setTimeout(resolve, 20));
                    }
                    throw new Error(
                        `Expected ${count} concurrent launch queries to wait on the cohort lock`
                    );
                };
                first = launch();
                await waitForBlocked(1);
                second = launch();
                await waitForBlocked(2);
            } finally {
                await blocker.query('ROLLBACK');
                blocker.release();
            }
            if (!first || !second) throw new Error('Concurrent launches did not start');
            const results = await Promise.allSettled([first, second]);
            const succeeded = results.filter(
                (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof launch>>> =>
                    result.status === 'fulfilled'
            );
            const rejected = results.filter(
                (result): result is PromiseRejectedResult => result.status === 'rejected'
            );
            for (const result of succeeded) migrationIds.push(result.value.planMigrationId);
            expect(succeeded).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0]?.reason).toMatchObject({ reason: 'PLAN_MIGRATION_COHORT_CHANGED' });
            const rows = await getServiceTestDb()
                .select({ status: planMigrationSubscriptions.status })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            expect(rows).toEqual([{ status: 'PENDIENTE' }]);
        });
    }
);
