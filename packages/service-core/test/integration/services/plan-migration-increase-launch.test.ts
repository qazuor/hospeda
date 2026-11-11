import {
    type DrizzleClient,
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    setDb
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    changeBillingDeadline,
    getCurrentBillingDeadlines
} from '../../../src/services/billing/deadlines/billing-deadlines.service.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { listPlanMigrationOptions } from '../../../src/services/billing/plan-migration/plan-migration-options.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPriceIncreaseCase,
    migrationClock
} from './support/plan-migration-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

type IncreaseCase = Awaited<ReturnType<typeof createPriceIncreaseCase>>;
const migrationIds: string[] = [];
const recipientIds: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    if (recipientIds.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, recipientIds.splice(0)));
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

const announcedTargetDate = getLocalDateString({ instant: migrationClock.now() });

async function launchIncrease(seeded: IncreaseCase, reader: DrizzleClient = getServiceTestDb()) {
    recipientIds.push(seeded.user.id);
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.increaseTarget.id,
        reason: 'PRICE_INCREASE' as const
    };
    const preview = await previewPlanMigration({
        actor: seeded.actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const launched = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    const [scope] = await reader
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
    if (!scope) throw new Error('Increase scope row missing');
    return { preview, launched, scope };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:10 AC:B12:9 el aumento anunciado, con la fecha de cada cliente — lanzamiento',
    () => {
        it('se avisa con al menos 60 días (el plazo 11) y el aumento anunciado guarda la versión de plazos con que se anunció', async () => {
            // The case is seeded outside the transaction; only the deadline publication and
            // the launch run inside it, so the immutable deadline version rolls back.
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const db = getServiceTestDb();
            const rollback = new Error('rollback increase deadline publication');
            try {
                await db.transaction(async (tx) => {
                    setDb(tx as unknown as DrizzleClient);
                    try {
                        const current = await getCurrentBillingDeadlines();
                        const changed = await changeBillingDeadline({
                            actor: seeded.actor,
                            key: 11,
                            value: { noticeDays: 75, contactDays: [30, 7] },
                            expectedVersion: current.version,
                            confirmed: true
                        });
                        expect(changed.values['11'].noticeDays).toBe(75);
                        expect(changed.values['12'].noticeDays).toBe(60);
                        const { preview, launched } = await launchIncrease(seeded, tx);
                        expect(preview.noticeDays).toBe(75);
                        const [stored] = await tx
                            .select()
                            .from(planMigrations)
                            .where(eq(planMigrations.id, launched.planMigrationId));
                        expect({
                            reason: stored?.reason,
                            noticeDays: stored?.noticeDays,
                            deadlineVersion: stored?.deadlineVersion
                        }).toEqual({
                            reason: 'PRICE_INCREASE',
                            noticeDays: 75,
                            deadlineVersion: changed.version
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

        it('no hay cohorte PARA_RESOLVER', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const { launched } = await launchIncrease(seeded);
            const statuses = await getServiceTestDb()
                .select({ status: planMigrationSubscriptions.status })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
            expect(statuses.map((row) => row.status)).toEqual(['PENDIENTE']);

            const missingCycle = await createPriceIncreaseCase({
                sourceCycle: 'annual',
                targetCycle: 'monthly',
                targetAmountMinor: 350000
            });
            await expect(
                previewPlanMigration({
                    actor: missingCycle.actor,
                    input: {
                        sourcePlanVersionId: missingCycle.planVersionId,
                        targetPlanVersionId: missingCycle.increaseTarget.id,
                        reason: 'PRICE_INCREASE'
                    },
                    verticals: missingCycle.verticals,
                    clock: migrationClock
                })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_INCREASE_CYCLE_MISSING' });
            await expect(
                launchPlanMigration({
                    actor: missingCycle.actor,
                    input: {
                        sourcePlanVersionId: missingCycle.planVersionId,
                        targetPlanVersionId: missingCycle.increaseTarget.id,
                        reason: 'PRICE_INCREASE',
                        cohortFingerprint: 'a'.repeat(64)
                    },
                    verticals: missingCycle.verticals,
                    clock: migrationClock
                })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_INCREASE_CYCLE_MISSING' });
            const db = getServiceTestDb();
            const writtenMigrations = await db
                .select({ id: planMigrations.id })
                .from(planMigrations)
                .where(eq(planMigrations.sourcePlanVersionId, missingCycle.planVersionId));
            const writtenRows = await db
                .select({ id: planMigrationSubscriptions.id })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.subscriptionId, missingCycle.predecessor.id));
            expect(writtenMigrations).toEqual([]);
            expect(writtenRows).toEqual([]);
        });

        it('la fecha en que le toca a ese cliente', async () => {
            // The 60-day deadline lands on 2026-12-10; a charge exactly that day goes to the customer.
            const monthly = await createPriceIncreaseCase({
                targetAmountMinor: 350000,
                nextChargeAt: new Date('2026-12-10T12:00:00.000Z')
            });
            const monthlyLaunch = await launchIncrease(monthly);
            expect(monthlyLaunch.preview.rows[0]?.applicationDate).toBe('2027-01-10');
            expect(monthlyLaunch.launched.rows[0]?.applicationDate).toBe('2027-01-10');

            // An annual renewal inside the 60 days is pushed to the next renewal.
            const annual = await createPriceIncreaseCase({
                sourceCycle: 'annual',
                targetAmountMinor: 350000,
                nextChargeAt: new Date('2026-11-20T12:00:00.000Z')
            });
            const annualLaunch = await launchIncrease(annual);
            expect(annualLaunch.preview.rows[0]?.applicationDate).toBe('2027-11-20');
            expect(annualLaunch.launched.rows[0]?.applicationDate).toBe('2027-11-20');
        });

        it('lleva el precio actual y el precio nuevo al anuncio', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const { preview, launched, scope } = await launchIncrease(seeded);
            const dedupKey = planMigrationNoticeDedupKey({
                recipientUserId: seeded.user.id,
                template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
                planMigrationSubscriptionId: scope.id,
                milestone: 'mig:announce',
                targetDate: announcedTargetDate
            });
            const [mail] = await getServiceTestDb()
                .select({ payload: emailOutbox.payload, dedupKey: emailOutbox.dedupKey })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.user.id));
            expect(mail?.dedupKey).toBe(dedupKey);
            expect(mail?.payload).toEqual({
                planMigrationId: launched.planMigrationId,
                planMigrationSubscriptionId: scope.id,
                subscriptionId: seeded.predecessor.id,
                vertical: 'accommodation',
                planName: 'Succession plan',
                targetPlanName: 'Succession plan',
                direction: 'UP',
                currentAmountMinor: 250000,
                newAmountMinor: 350000,
                currency: 'ARS',
                applicationDate: preview.rows[0]?.applicationDate,
                losesPromo: false,
                variant: 'SCHEDULED',
                deadlinesVersion: preview.deadlineVersion,
                reason: 'PRICE_INCREASE'
            });
        });

        it('aplica la promo viva sobre el precio nuevo', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            await seedPlanChangePromo({
                subscriptionId: seeded.predecessor.id,
                userId: seeded.user.id
            });
            // 350000 list minus the seeded FIXED 1000 promo.
            const { preview, launched, scope } = await launchIncrease(seeded);
            expect(preview.rows[0]?.currentAmount).toBe(249000);
            expect(preview.rows[0]?.newAmount).toBe(349000);
            expect(preview.rows[0]?.losesPromo).toBe(false);
            const [mail] = await getServiceTestDb()
                .select({ payload: emailOutbox.payload })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.user.id));
            expect(mail?.payload).toEqual({
                planMigrationId: launched.planMigrationId,
                planMigrationSubscriptionId: scope.id,
                subscriptionId: seeded.predecessor.id,
                vertical: 'accommodation',
                planName: 'Succession plan',
                targetPlanName: 'Succession plan',
                direction: 'UP',
                currentAmountMinor: 249000,
                newAmountMinor: 349000,
                currency: 'ARS',
                applicationDate: preview.rows[0]?.applicationDate,
                losesPromo: false,
                variant: 'SCHEDULED',
                deadlinesVersion: preview.deadlineVersion,
                reason: 'PRICE_INCREASE'
            });
        });

        it('las opciones ofrecen el par de aumento y no lo mezclan con las versiones retiradas', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const options = await listPlanMigrationOptions({
                actor: seeded.actor,
                verticals: {
                    planPolicy: async ({ planVersionId }) => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: planVersionId !== seeded.planVersionId,
                        sellable: true
                    })
                }
            });
            expect(
                options.increases
                    .filter((entry) => entry.source.id === seeded.planVersionId)
                    .map((entry) => ({
                        source: entry.source,
                        target: entry.target
                    }))
            ).toEqual([
                {
                    source: {
                        id: seeded.planVersionId,
                        planId: seeded.planId,
                        name: 'Succession plan',
                        vertical: 'accommodation',
                        customerCount: 1
                    },
                    target: {
                        id: seeded.increaseTarget.id,
                        planId: seeded.planId,
                        name: 'Succession plan',
                        vertical: 'accommodation'
                    }
                }
            ]);
            expect(options.sources.filter((row) => row.id === seeded.planVersionId)).toEqual([]);
        });

        it('rechaza el aumento a otro plan y el aumento desde la versión vigente', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            await expect(
                previewPlanMigration({
                    actor: seeded.actor,
                    input: {
                        sourcePlanVersionId: seeded.planVersionId,
                        targetPlanVersionId: seeded.targetPlanVersionId,
                        reason: 'PRICE_INCREASE'
                    },
                    verticals: seeded.verticals,
                    clock: migrationClock
                })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_INCREASE_OTHER_PLAN' });
            await expect(
                previewPlanMigration({
                    actor: seeded.actor,
                    input: {
                        sourcePlanVersionId: seeded.increaseTarget.id,
                        targetPlanVersionId: seeded.planVersionId,
                        reason: 'PRICE_INCREASE'
                    },
                    verticals: seeded.verticals,
                    clock: migrationClock
                })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_INCREASE_SOURCE_CURRENT' });
        });
    }
);
