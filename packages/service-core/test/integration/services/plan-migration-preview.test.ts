import { eq, planVersions, subscriptions, users } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { listPlanMigrationOptions } from '../../../src/services/billing/plan-migration/plan-migration-options.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedCoveragePlanVersion } from './support/coverage-fixtures.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    insertMigrationVersion,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';

afterEach(cleanupPlanMigrationCases);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:2 AC:B12:2 la acción 17 y su previsualización',
    () => {
        it('lists retired source options and current sellable targets by vertical', async () => {
            const seeded = await createPlanMigrationCase();
            const options = await listPlanMigrationOptions({
                actor: seeded.actor,
                verticals: {
                    planPolicy: async ({ planVersionId }) => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: true,
                        sellable: planVersionId !== seeded.retired.id
                    })
                }
            });
            expect(options.sources.filter((row) => row.id === seeded.planVersionId)).toEqual([
                {
                    id: seeded.planVersionId,
                    planId: seeded.planId,
                    name: 'Succession plan',
                    vertical: 'accommodation',
                    // The source is the first version created for its plan.
                    versionNumber: 1,
                    customerCount: 1
                }
            ]);
            expect(
                (options.targets.accommodation ?? []).filter(
                    (row) => row.id === seeded.targetPlanVersionId
                )
            ).toEqual([
                {
                    id: seeded.targetPlanVersionId,
                    planId: expect.any(String),
                    name: 'Succession target plan',
                    vertical: 'accommodation',
                    // The target plan has a single version, so it restarts at 1.
                    versionNumber: 1
                }
            ]);
        });
        it('shows each reached customer with the contract direction, current and new price, and application date before confirmation', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
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
            const up = await previewPlanMigration({
                actor: seeded.actor,
                input,
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(
                up.rows.map((row) => ({
                    subscriptionId: row.subscriptionId,
                    status: row.status,
                    direction: row.direction,
                    currentAmount: row.currentAmount,
                    newAmount: row.newAmount,
                    applicationDate: row.applicationDate,
                    waits: row.waits,
                    outcome: row.outcome
                }))
            ).toEqual(
                [
                    {
                        subscriptionId: seeded.predecessor.id,
                        status: 'ACTIVE',
                        direction: 'UP',
                        currentAmount: 250000,
                        newAmount: 300000,
                        applicationDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                        waits: false,
                        outcome: 'PENDIENTE'
                    },
                    {
                        subscriptionId: seeded.pendingCustomer.subscriptionId,
                        status: 'PENDING_AUTHORIZATION',
                        direction: 'UP',
                        currentAmount: 250000,
                        newAmount: 300000,
                        applicationDate: '2026-12-11',
                        waits: true,
                        outcome: 'PENDIENTE'
                    }
                ].sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
            );
            expect(up).toMatchObject({ noticeDays: 60, launchable: true });
            expect(up.deadlineVersion).toBeGreaterThan(0);
            expect(up.cohortFingerprint).toMatch(/^[a-f0-9]{64}$/);

            // Action 18 publishes a higher-rank destination; the simulated DOWN verdict contradicts rank.
            const second = await createPlanMigrationCase();
            const db = getServiceTestDb();
            const [sourceVersion] = await db
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, seeded.planVersionId))
                .limit(1);
            const [oldTarget] = await db
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, second.targetPlanVersionId))
                .limit(1);
            if (!sourceVersion || !oldTarget) throw new Error('Direction fixture version missing');
            const higherTarget = await insertMigrationVersion({
                planId: oldTarget.planId,
                previousVersionId: oldTarget.id,
                rank: sourceVersion.rank + 1,
                sellable: true,
                graceDays: 10,
                allowsPause: false
            });
            expect(higherTarget.rank).toBeGreaterThan(sourceVersion.rank);
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: higherTarget.id,
                cycle: 'monthly',
                amount: 200000
            });
            seeded.verticals.setPlanPolicy({
                planVersionId: higherTarget.id,
                policy: {
                    current: true,
                    sellable: true,
                    graceDays: 10,
                    allowsPause: false
                }
            });
            seeded.verticals.setChangeDirection({
                fromPlanVersionId: seeded.planVersionId,
                toPlanVersionId: higherTarget.id,
                direction: 'DOWN'
            });
            const down = await previewPlanMigration({
                actor: seeded.actor,
                input: { ...input, targetPlanVersionId: higherTarget.id },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(
                down.rows.map((row) => ({
                    subscriptionId: row.subscriptionId,
                    direction: row.direction,
                    currentAmount: row.currentAmount,
                    newAmount: row.newAmount,
                    outcome: row.outcome
                }))
            ).toEqual(
                [
                    {
                        subscriptionId: seeded.predecessor.id,
                        direction: 'DOWN',
                        currentAmount: 250000,
                        newAmount: 200000,
                        outcome: 'PENDIENTE'
                    },
                    {
                        subscriptionId: seeded.pendingCustomer.subscriptionId,
                        direction: 'DOWN',
                        currentAmount: 250000,
                        newAmount: 200000,
                        outcome: 'PENDIENTE'
                    }
                ].sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
            );
            expect(down.direction).toBe('DOWN');
        });

        it('uses live promo composition and leaves an unsupported annual cycle for resolution', async () => {
            const monthly = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: monthly.actor,
                planVersionId: monthly.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            await seedPlanChangePromo({
                subscriptionId: monthly.predecessor.id,
                userId: monthly.user.id
            });
            const discounted = await previewPlanMigration({
                actor: monthly.actor,
                input: {
                    sourcePlanVersionId: monthly.planVersionId,
                    targetPlanVersionId: monthly.targetPlanVersionId
                },
                verticals: monthly.verticals,
                clock: migrationClock
            });
            expect(
                discounted.rows.map((row) => ({
                    currentAmount: row.currentAmount,
                    newAmount: row.newAmount,
                    losesPromo: row.losesPromo,
                    outcome: row.outcome
                }))
            ).toEqual([
                { currentAmount: 249000, newAmount: 300000, losesPromo: true, outcome: 'PENDIENTE' }
            ]);

            const annual = await createPlanMigrationCase({ sourceCycle: 'annual' });
            const unresolved = await previewPlanMigration({
                actor: annual.actor,
                input: {
                    sourcePlanVersionId: annual.planVersionId,
                    targetPlanVersionId: annual.targetPlanVersionId
                },
                verticals: annual.verticals,
                clock: migrationClock
            });
            expect(
                unresolved.rows.map((row) => ({
                    cycle: row.cycle,
                    currentAmount: row.currentAmount,
                    newAmount: row.newAmount,
                    applicationDate: row.applicationDate,
                    outcome: row.outcome
                }))
            ).toEqual([
                {
                    cycle: 'annual',
                    currentAmount: 250000,
                    newAmount: null,
                    applicationDate: null,
                    outcome: 'PARA_RESOLVER'
                }
            ]);
            await setMigrationTargetCycle({
                actor: annual.actor,
                planVersionId: annual.targetPlanVersionId,
                cycle: 'annual',
                amount: 400000
            });
            const pricedAnnual = await previewPlanMigration({
                actor: annual.actor,
                input: {
                    sourcePlanVersionId: annual.planVersionId,
                    targetPlanVersionId: annual.targetPlanVersionId
                },
                verticals: annual.verticals,
                clock: migrationClock
            });
            expect(
                pricedAnnual.rows.map((row) => ({
                    cycle: row.cycle,
                    currentAmount: row.currentAmount,
                    newAmount: row.newAmount,
                    applicationDate: row.applicationDate,
                    outcome: row.outcome
                }))
            ).toEqual([
                {
                    cycle: 'annual',
                    currentAmount: 250000,
                    newAmount: 400000,
                    applicationDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                    outcome: 'PENDIENTE'
                }
            ]);
        });

        it('excludes the actor account while retaining the other clients and rejects an empty launch', async () => {
            const own = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: own.actor,
                planVersionId: own.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const actor = { ...own.actor, id: own.user.id };
            const preview = await previewPlanMigration({
                actor,
                input: {
                    sourcePlanVersionId: own.planVersionId,
                    targetPlanVersionId: own.targetPlanVersionId
                },
                verticals: own.verticals,
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
                    subscriptionId: own.predecessor.id,
                    direction: null,
                    outcome: 'EXCLUDED',
                    excludedReason: 'ACTOR_IS_SUBJECT'
                }
            ]);
            expect(preview.launchable).toBe(false);
        });

        it('reads exactly principal subscriptions in the five states, leaving scheduled cancellations out', async () => {
            const seeded = await createPlanMigrationCase();
            await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            // No production driver creates these catalog-only test states or a complement on the same plan.
            const db = getServiceTestDb();
            const [scheduledUser] = await db
                .insert(users)
                .values({
                    email: `scheduled-${crypto.randomUUID()}@example.test`,
                    displayName: 'Scheduled customer',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!scheduledUser) throw new Error('Scheduled customer fixture missing');
            const [cancelled, complement] = await db
                .insert(subscriptions)
                .values([
                    {
                        userId: scheduledUser.id,
                        vertical: 'accommodation',
                        planVersionId: seeded.planVersionId,
                        billingOptionId: seeded.predecessorBillingOptionId,
                        paymentMethod: 'CARD',
                        status: 'CANCEL_SCHEDULED',
                        class: 'PRINCIPAL'
                    },
                    {
                        userId: seeded.user.id,
                        vertical: 'accommodation',
                        planVersionId: seeded.planVersionId,
                        billingOptionId: seeded.predecessorBillingOptionId,
                        paymentMethod: 'CARD',
                        status: 'ACTIVE',
                        class: 'COMPLEMENTO'
                    }
                ])
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
                expect(preview.rows.map((row) => row.subscriptionId)).toEqual([
                    seeded.predecessor.id
                ]);
            } finally {
                for (const row of [cancelled, complement])
                    if (row) await db.delete(subscriptions).where(eq(subscriptions.id, row.id));
                await db.delete(users).where(eq(users.id, scheduledUser.id));
            }
        });

        it('rejects non-sellable and non-current destinations by contract and a source plan still for sale', async () => {
            const seeded = await createPlanMigrationCase();
            const input = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId
            };
            seeded.verticals.setPlanPolicy({
                planVersionId: seeded.targetPlanVersionId,
                policy: {
                    current: true,
                    sellable: false,
                    graceDays: 10,
                    allowsPause: false
                }
            });
            await expect(
                previewPlanMigration({ actor: seeded.actor, input, verticals: seeded.verticals })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_TARGET_NOT_SELLABLE' });
            seeded.verticals.setPlanPolicy({
                planVersionId: seeded.targetPlanVersionId,
                policy: {
                    current: false,
                    sellable: true,
                    graceDays: 10,
                    allowsPause: false
                }
            });
            await expect(
                previewPlanMigration({ actor: seeded.actor, input, verticals: seeded.verticals })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_TARGET_NOT_SELLABLE' });
            seeded.verticals.setPlanPolicy({
                planVersionId: seeded.retired.id,
                policy: {
                    current: true,
                    sellable: true,
                    graceDays: 10,
                    allowsPause: false
                }
            });
            await expect(
                previewPlanMigration({ actor: seeded.actor, input, verticals: seeded.verticals })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_SOURCE_NOT_RETIRED' });
        });

        it('rejects a destination in another vertical, the same version, and missing versions in order', async () => {
            const seeded = await createPlanMigrationCase();
            // A base catalog version is seeded because this test only exercises version identity.
            const otherVertical = await seedCoveragePlanVersion(getServiceTestDb(), 'experience');
            const base = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId
            };
            await expect(
                previewPlanMigration({
                    actor: seeded.actor,
                    input: { ...base, targetPlanVersionId: otherVertical.planVersionId },
                    verticals: seeded.verticals
                })
            ).rejects.toMatchObject({
                reason: 'PLAN_MIGRATION_VERTICAL_MISMATCH'
            });
            await expect(
                previewPlanMigration({
                    actor: seeded.actor,
                    input: { ...base, targetPlanVersionId: seeded.planVersionId },
                    verticals: seeded.verticals
                })
            ).rejects.toMatchObject({
                reason: 'PLAN_MIGRATION_SAME_VERSION'
            });
            await expect(
                previewPlanMigration({
                    actor: seeded.actor,
                    input: { ...base, targetPlanVersionId: crypto.randomUUID() },
                    verticals: seeded.verticals
                })
            ).rejects.toMatchObject({
                reason: 'PLAN_VERSION_NOT_FOUND'
            });
        });
    }
);
