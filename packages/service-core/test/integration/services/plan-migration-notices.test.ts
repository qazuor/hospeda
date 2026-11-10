import {
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    subscriptions
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    changeBillingDeadline,
    getCurrentBillingDeadlines
} from '../../../src/services/billing/deadlines/billing-deadlines.service.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { sendPlanMigrationNotices } from '../../../src/services/billing/plan-migration/send-plan-migration-notices.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';

type Case = Awaited<ReturnType<typeof createPlanMigrationCase>>;
const migrationIds: string[] = [];
const recipientIds: string[] = [];
const db = getServiceTestDb();

// The shared fixture seeds catalog versions and an actor; startSubscription creates the principal.
async function launch(seeded: Case) {
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
    const launched = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    recipientIds.push(seeded.user.id);
    if (seeded.pendingCustomer) recipientIds.push(seeded.pendingCustomer.userId);
    const [scope] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
    if (!scope) throw new Error('Migration scope missing');
    return { launched, scope, preview };
}

async function outboxFor(userId: string) {
    return db
        .select({
            template: emailOutbox.template,
            payload: emailOutbox.payload,
            dedupKey: emailOutbox.dedupKey
        })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
}

function movableClock(initial: string) {
    let current = new Date(initial);
    return {
        now: () => current,
        set: (instant: string) => {
            current = new Date(instant);
        }
    };
}

afterEach(async () => {
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

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:3 AC:B12:3 el aviso, sus correos y la fecha de cada cliente',
    () => {
        it('monthly ACTIVE receives 30 and 7 local days before its application, with exact payload and dedup', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { launched, scope, preview } = await launch(seeded);
            expect(launched.noticeDays).toBe(60);
            expect(scope.applicationDate).toEqual(new Date('2026-12-11T12:00:00.000Z'));
            const clock = movableClock('2026-11-10T12:00:00.000Z');
            const run = () => sendPlanMigrationNotices({ limit: 100, db }, { clock });
            expect((await run()).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'NOT_DUE',
                    milestone: null,
                    recalculated: false
                }
            ]);
            expect(await outboxFor(seeded.user.id)).toHaveLength(1);
            clock.set('2026-11-11T12:00:00.000Z');
            expect((await run()).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'ENQUEUED',
                    milestone: 'mig:-30d',
                    recalculated: false
                }
            ]);
            expect((await run()).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'ALREADY_ENQUEUED',
                    milestone: 'mig:-30d',
                    recalculated: false
                }
            ]);
            clock.set('2026-12-04T12:00:00.000Z');
            expect((await run()).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'ENQUEUED',
                    milestone: 'mig:-7d',
                    recalculated: false
                }
            ]);
            const rows = await outboxFor(seeded.user.id);
            expect(rows).toHaveLength(3);
            const upcoming = rows.filter(
                (row) => row.template === 'billing.plan-migration-upcoming'
            );
            expect(upcoming).toHaveLength(2);
            expect(upcoming.map(({ payload }) => payload)).toEqual([
                {
                    planMigrationId: launched.planMigrationId,
                    planMigrationSubscriptionId: scope.id,
                    subscriptionId: seeded.predecessor.id,
                    vertical: 'accommodation',
                    planName: (
                        rows.find((row) => row.template === 'billing.plan-migration-announced')
                            ?.payload as { planName: string }
                    ).planName,
                    targetPlanName: (
                        rows.find((row) => row.template === 'billing.plan-migration-announced')
                            ?.payload as { targetPlanName: string }
                    ).targetPlanName,
                    direction: preview.direction,
                    currentAmountMinor: preview.rows[0]?.currentAmount,
                    newAmountMinor: preview.rows[0]?.newAmount,
                    currency: preview.rows[0]?.currency,
                    applicationDate: '2026-12-11',
                    daysBefore: 30,
                    losesPromo: preview.rows[0]?.losesPromo,
                    variant: 'SCHEDULED',
                    deadlinesVersion: launched.deadlineVersion
                },
                {
                    planMigrationId: launched.planMigrationId,
                    planMigrationSubscriptionId: scope.id,
                    subscriptionId: seeded.predecessor.id,
                    vertical: 'accommodation',
                    planName: (
                        rows.find((row) => row.template === 'billing.plan-migration-announced')
                            ?.payload as { planName: string }
                    ).planName,
                    targetPlanName: (
                        rows.find((row) => row.template === 'billing.plan-migration-announced')
                            ?.payload as { targetPlanName: string }
                    ).targetPlanName,
                    direction: preview.direction,
                    currentAmountMinor: preview.rows[0]?.currentAmount,
                    newAmountMinor: preview.rows[0]?.newAmount,
                    currency: preview.rows[0]?.currency,
                    applicationDate: '2026-12-11',
                    daysBefore: 7,
                    losesPromo: preview.rows[0]?.losesPromo,
                    variant: 'SCHEDULED',
                    deadlinesVersion: launched.deadlineVersion
                }
            ]);
        });

        it('uses the next renewal after an exact deadline tie and works for annual cycles', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'annual',
                amount: 300000
            });
            // The existing fixture sets next_charge_at. This seeded date exercises the exact-day tie.
            await db
                .update(subscriptions)
                .set({ nextChargeAt: new Date('2026-12-10T13:00:00.000Z') })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            const { scope } = await launch(seeded);
            expect(getLocalDateString({ instant: scope.applicationDate })).toBe('2027-12-10');
            const clock = movableClock('2027-11-09T12:00:00.000Z');
            const run = () => sendPlanMigrationNotices({ limit: 100, db }, { clock });
            expect((await run()).notDue).toBe(1);
            clock.set('2027-11-10T12:00:00.000Z');
            expect((await run()).rows[0]?.milestone).toBe('mig:-30d');
            clock.set('2027-12-03T12:00:00.000Z');
            expect((await run()).rows[0]?.milestone).toBe('mig:-7d');
            expect((await outboxFor(seeded.user.id)).map((row) => row.template).sort()).toEqual([
                'billing.plan-migration-announced',
                'billing.plan-migration-upcoming',
                'billing.plan-migration-upcoming'
            ]);
        });

        it('an annual customer renewing ten months later receives no early reminder', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'annual',
                amount: 300000
            });
            // The existing fixture seeds next_charge_at; this date places the annual renewal ten months out.
            await db
                .update(subscriptions)
                .set({ nextChargeAt: new Date('2027-08-11T13:00:00.000Z') })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            const { scope } = await launch(seeded);
            expect(getLocalDateString({ instant: scope.applicationDate })).toBe('2027-08-11');
            const clock = movableClock('2027-07-11T12:00:00.000Z');
            const run = () => sendPlanMigrationNotices({ limit: 100, db }, { clock });
            expect((await run()).rows[0]?.outcome).toBe('NOT_DUE');
            expect(await outboxFor(seeded.user.id)).toHaveLength(1);
            clock.set('2027-07-12T12:00:00.000Z');
            expect((await run()).rows[0]?.milestone).toBe('mig:-30d');
            clock.set('2027-08-04T12:00:00.000Z');
            expect((await run()).rows[0]?.milestone).toBe('mig:-7d');
            expect(await outboxFor(seeded.user.id)).toHaveLength(3);
        });

        it('rejects a shorter notice without changing the current deadline version', async () => {
            const seeded = await createPlanMigrationCase();
            const before = await getCurrentBillingDeadlines();
            await expect(
                changeBillingDeadline({
                    actor: seeded.actor,
                    key: 12,
                    value: { noticeDays: 59, contactDays: [30, 7] },
                    expectedVersion: before.version,
                    confirmed: true
                })
            ).rejects.toThrow();
            expect((await getCurrentBillingDeadlines()).version).toBe(before.version);
        });

        it('keeps the stored version and application date after a later deadline is published', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { launched, scope } = await launch(seeded);
            const before = await getCurrentBillingDeadlines();
            try {
                await changeBillingDeadline({
                    actor: seeded.actor,
                    key: 12,
                    value: { noticeDays: 90, contactDays: [45, 10] },
                    expectedVersion: before.version,
                    confirmed: true
                });
                const clock = movableClock('2026-11-11T12:00:00.000Z');
                const run = () => sendPlanMigrationNotices({ limit: 100, db }, { clock });
                expect((await run()).rows[0]?.milestone).toBe('mig:-30d');
                const [after] = await db
                    .select()
                    .from(planMigrationSubscriptions)
                    .where(eq(planMigrationSubscriptions.id, scope.id));
                expect(after?.applicationDate).toEqual(scope.applicationDate);
                const upcoming = (await outboxFor(seeded.user.id)).filter(
                    (row) => row.template === 'billing.plan-migration-upcoming'
                );
                expect(upcoming).toHaveLength(1);
                expect(
                    (upcoming[0]?.payload as { deadlinesVersion: number }).deadlinesVersion
                ).toBe(launched.deadlineVersion);
            } finally {
                const current = await getCurrentBillingDeadlines();
                await changeBillingDeadline({
                    actor: seeded.actor,
                    key: 12,
                    value: before.values['12'],
                    expectedVersion: current.version,
                    confirmed: true
                });
            }
        });
    }
);
