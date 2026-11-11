import {
    and,
    type DrizzleClient,
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    setDb
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    changeBillingDeadline,
    getCurrentBillingDeadlines
} from '../../../src/services/billing/deadlines/billing-deadlines.service.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { sendPlanMigrationNotices } from '../../../src/services/billing/plan-migration/send-plan-migration-notices.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
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
});
afterAll(closeServiceTestPool);

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

/** Shift a local `YYYY-MM-DD` day by a signed number of days. */
function shiftLocalDay(day: string, days: number): string {
    const value = new Date(`${day}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

/** A market-local morning on the given day, safe for the notice window comparison. */
function instantAt(day: string): Date {
    return new Date(`${day}T13:00:00.000Z`);
}

function upcomingKey(recipientUserId: string, scopeId: string, milestone: string, target: string) {
    return planMigrationNoticeDedupKey({
        recipientUserId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: scopeId,
        milestone,
        targetDate: target
    });
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:10 AC:B12:9 los tres contactos del aumento — al anunciar, a 30 y a 7 días',
    () => {
        it('a 31 días no hay aviso; a 30 y a 7 se encolan con el precio actual, el nuevo y la fecha de cada cliente', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const { launched, scope } = await launchIncrease(seeded);
            const applicationDate = getLocalDateString({ instant: scope.applicationDate });
            const db = getServiceTestDb();
            const notify = (days: number) =>
                db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({
                        tx,
                        planMigrationSubscriptionId: scope.id,
                        now: instantAt(shiftLocalDay(applicationDate, -days))
                    })
                );

            expect(await notify(31)).toEqual({
                outcome: 'NOT_DUE',
                milestone: null,
                recalculated: false
            });
            expect(
                await db
                    .select({ id: emailOutbox.id })
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.recipientUserId, seeded.user.id),
                            eq(emailOutbox.template, PLAN_MIGRATION_UPCOMING_TEMPLATE)
                        )
                    )
            ).toEqual([]);

            expect(await notify(30)).toEqual({
                outcome: 'ENQUEUED',
                milestone: 'mig:-30d',
                recalculated: false
            });
            expect(await notify(7)).toEqual({
                outcome: 'ENQUEUED',
                milestone: 'mig:-7d',
                recalculated: false
            });

            const rows = await db
                .select({ dedupKey: emailOutbox.dedupKey, payload: emailOutbox.payload })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, seeded.user.id),
                        eq(emailOutbox.template, PLAN_MIGRATION_UPCOMING_TEMPLATE)
                    )
                );
            expect(rows.map((row) => row.dedupKey).sort()).toEqual(
                [
                    upcomingKey(seeded.user.id, scope.id, 'mig:-30d', applicationDate),
                    upcomingKey(seeded.user.id, scope.id, 'mig:-7d', applicationDate)
                ].sort()
            );
            const payloads = rows
                .map(({ payload }) => payload as { daysBefore: number })
                .sort((left, right) => right.daysBefore - left.daysBefore);
            expect(payloads).toEqual([
                {
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
                    applicationDate,
                    daysBefore: 30,
                    losesPromo: false,
                    variant: 'SCHEDULED',
                    providerNotifies: false,
                    deadlinesVersion: launched.deadlineVersion,
                    reason: 'PRICE_INCREASE'
                },
                {
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
                    applicationDate,
                    daysBefore: 7,
                    losesPromo: false,
                    variant: 'SCHEDULED',
                    providerNotifies: true,
                    deadlinesVersion: launched.deadlineVersion,
                    reason: 'PRICE_INCREASE'
                }
            ]);
        });

        it('el lote de avisos toma la fila del aumento a 30 días', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const { scope } = await launchIncrease(seeded);
            const applicationDate = getLocalDateString({ instant: scope.applicationDate });

            const result = await sendPlanMigrationNotices(
                { limit: 100, db: getServiceTestDb() },
                { clock: { now: () => instantAt(shiftLocalDay(applicationDate, -30)) } }
            );

            expect(
                result.rows.filter((row) => row.planMigrationSubscriptionId === scope.id)
            ).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'ENQUEUED',
                    milestone: 'mig:-30d',
                    recalculated: false
                }
            ]);
        });

        it('una versión de plazos 11 con contactos [20, 5] mueve los hitos a mig:-20d y mig:-5d', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            const db = getServiceTestDb();
            const rollback = new Error('rollback increase deadline contacts');
            try {
                await db.transaction(async (tx) => {
                    setDb(tx as unknown as DrizzleClient);
                    try {
                        const current = await getCurrentBillingDeadlines();
                        const changed = await changeBillingDeadline({
                            actor: seeded.actor,
                            key: 11,
                            value: { noticeDays: 60, contactDays: [20, 5] },
                            expectedVersion: current.version,
                            confirmed: true
                        });
                        expect(changed.values['11'].contactDays).toEqual([20, 5]);
                        const { launched, scope } = await launchIncrease(seeded, tx);
                        const applicationDate = getLocalDateString({
                            instant: scope.applicationDate
                        });
                        const notify = (days: number) =>
                            applyPlanMigrationUpcomingNotice({
                                tx,
                                planMigrationSubscriptionId: scope.id,
                                now: instantAt(shiftLocalDay(applicationDate, -days))
                            });

                        expect(await notify(20)).toEqual({
                            outcome: 'ENQUEUED',
                            milestone: 'mig:-20d',
                            recalculated: false
                        });
                        expect(await notify(5)).toEqual({
                            outcome: 'ENQUEUED',
                            milestone: 'mig:-5d',
                            recalculated: false
                        });
                        const rows = await tx
                            .select({
                                dedupKey: emailOutbox.dedupKey,
                                payload: emailOutbox.payload
                            })
                            .from(emailOutbox)
                            .where(
                                and(
                                    eq(emailOutbox.recipientUserId, seeded.user.id),
                                    eq(emailOutbox.template, PLAN_MIGRATION_UPCOMING_TEMPLATE)
                                )
                            );
                        expect(rows.map((row) => row.dedupKey).sort()).toEqual(
                            [
                                upcomingKey(seeded.user.id, scope.id, 'mig:-20d', applicationDate),
                                upcomingKey(seeded.user.id, scope.id, 'mig:-5d', applicationDate)
                            ].sort()
                        );
                        expect(
                            rows
                                .map(
                                    (row) =>
                                        row.payload as {
                                            daysBefore: number;
                                            providerNotifies: boolean;
                                        }
                                )
                                .map(({ daysBefore, providerNotifies }) => ({
                                    daysBefore,
                                    providerNotifies
                                }))
                                .sort((left, right) => left.daysBefore - right.daysBefore)
                        ).toEqual([
                            { daysBefore: 5, providerNotifies: true },
                            { daysBefore: 20, providerNotifies: false }
                        ]);
                        const [stored] = await tx
                            .select({ reason: planMigrations.reason })
                            .from(planMigrations)
                            .where(eq(planMigrations.id, launched.planMigrationId));
                        expect(stored?.reason).toBe('PRICE_INCREASE');
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
