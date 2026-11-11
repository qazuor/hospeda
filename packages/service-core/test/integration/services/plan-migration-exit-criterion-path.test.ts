import {
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';
import { localDayInstant, shiftLocalDay } from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    S37_TARGET_AMOUNT_MINOR,
    type S37Case
} from './support/plan-migration-s37-fixtures.js';

/*
 * TEST:B12:8 — map of the ten LISTA:B12 clauses to the test that proves each one.
 *
 *  1. Retiring a plan moves nobody ................ apps/api/test/integration/plan-publication/plan-retire-moves-nobody.test.ts:311 (TEST:B4:12)
 *  2. Monthly at 60 days: mutation -7d on the same authorization, read back, version on renewal .... plan-migration-exit-criterion-path.test.ts:120 (a)
 *  3. Annual renewing in ten months: nothing until then ........................................... plan-migration-exit-criterion-path.test.ts:201 (b)
 *  4. No matching cycle in the destination: listed, untouched .................................... plan-migration-exit-criterion-cases.test.ts:158 (c)
 *  5. Paused: waits (plus HOS-2108, c1) .......................................................... plan-migration-exit-criterion-cases.test.ts:190 (d)
 *  6. Changed plan in between: exits ............................................................. plan-migration-exit-criterion-cases.test.ts:235 (e)
 *  7. Cancelling: applied rows intact, each pending one gets «nothing changes» ................... plan-migration-exit-criterion-cases.test.ts:272 (f)
 *  8. Every version of a vertical retired: S1 rejects, insiders unchanged ........................ plan-retire-moves-nobody.test.ts:352 (TEST:B4:12)
 *  9. Price increase: each customer's own date, no charge at the new price before it ............. plan-migration-increase-e2e-dates.test.ts:142 (TEST:B12:10, clauses 1-5)
 * 10. Price increase through S37 and S38, none PARA_RESOLVER, live promo kept .................... plan-migration-increase-e2e-mutation.test.ts:147 (TEST:B12:10, clauses 6-8 and 10)
 *                                                                                                + plan-migration-increase-e2e-dates.test.ts:312 (clause 9)
 *
 * Clauses 1, 8, 9 and 10 are NOT rewritten here (D-5): they run in this run's gate and are cited.
 */

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
/** Announcement (migrationClock) plus 60 notice days ends on 2026-12-10; S37_NEXT_CHARGE_AT is 2026-12-11. */
const MONTHLY_APPLICATION_DAY = '2026-12-11';
const migrationIds: string[] = [];
const recipients: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    if (recipients.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, recipients.splice(0)));
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupS37Cases();
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

function runS37(scopeId: string, provider: PaymentProvider, clock: { readonly now: () => Date }) {
    return runPlanMigrationS37ForRow(
        { planMigrationSubscriptionId: scopeId, correlationId: crypto.randomUUID() },
        { provider, clock }
    );
}

function upcomingKey(caseRow: S37Case, targetDate: string): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:-7d',
        targetDate
    });
}

async function subscriptionSnapshot(subscriptionId: string) {
    const [row] = await db
        .select({
            planVersionId: subscriptions.planVersionId,
            billingOptionId: subscriptions.billingOptionId,
            nextChargeAt: subscriptions.nextChargeAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row;
}

async function queueRows(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:8 AC:B12:8 el criterio de salida de B12 — el camino del mensual y del anual',
    () => {
        it('una migración anunciada con 60 días a un cliente mensual le muta el monto sobre la misma autorización siete días antes de su primera renovación posterior a los 60 días, relee que quedó, y le cambia la versión en esa renovación', async () => {
            const caseRow = await createS37MigrationCase();
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            const authorize = vi.spyOn(caseRow.fake, 'authorize');

            const applicationDay = getLocalDateString({ instant: caseRow.scope.applicationDate });
            expect(shiftLocalDay('2026-10-11', 60)).toBe('2026-12-10');
            expect(applicationDay).toBe(MONTHLY_APPLICATION_DAY);

            caseRow.clock.set(localDayInstant(shiftLocalDay(applicationDay, -8)));
            expect(await runS37(caseRow.scope.id, caseRow.provider, caseRow.clock)).toEqual({
                outcome: 'NOT_DUE',
                reason: 'NOT_YET_DUE'
            });
            expect(
                changeAmount.mock.calls.filter(
                    ([input]) => input.authorizationId === caseRow.authorizationId
                )
            ).toHaveLength(0);

            caseRow.clock.set(localDayInstant(shiftLocalDay(applicationDay, -7)));
            expect(
                await db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({
                        tx,
                        planMigrationSubscriptionId: caseRow.scope.id,
                        now: caseRow.clock.now()
                    })
                )
            ).toEqual({ outcome: 'ENQUEUED', milestone: 'mig:-7d', recalculated: false });
            // SEEDED: the sender stamps the third notice as delivered before S37 retries,
            // exactly like the S37 card fixture does. No service sends it inside the test.
            await db
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow, applicationDay)));

            expect(await runS37(caseRow.scope.id, caseRow.provider, caseRow.clock)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });
            expect(
                changeAmount.mock.calls.filter(
                    ([input]) => input.authorizationId === caseRow.authorizationId
                )
            ).toHaveLength(1);
            expect(authorize).toHaveBeenCalledTimes(0);
            const reread = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(reread.snapshot.amount).toEqual({
                amountMinor: S37_TARGET_AMOUNT_MINOR,
                currency: 'ARS'
            });

            const applied = await db.transaction((tx) =>
                applyScheduledChangeInTx({
                    subscriptionId: caseRow.subscriptionId,
                    now: localDayInstant(applicationDay),
                    tx
                })
            );
            expect(applied).toMatchObject({
                outcome: 'APPLIED',
                motive: 'RETIREMENT',
                toPlanVersionId: caseRow.targetPlanVersionId,
                toBillingOptionId: caseRow.targetOptionId
            });
            const [row] = await db
                .select({
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, caseRow.subscriptionId));
            expect(row).toEqual({
                planVersionId: caseRow.targetPlanVersionId,
                billingOptionId: caseRow.targetOptionId
            });
        });

        it('al anual que renueva en diez meses no le toca nada hasta entonces', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'annual',
                amount: 300000
            });
            // SEEDED: the shared fixture seeds next_charge_at two months out; this date places
            // the annual renewal ten months after the announcement. No service runs that renewal here.
            await db
                .update(subscriptions)
                .set({ nextChargeAt: new Date('2027-08-11T13:00:00.000Z') })
                .where(eq(subscriptions.id, seeded.predecessor.id));
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
            recipients.push(seeded.user.id);
            const [scope] = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
            if (!scope) throw new Error('Annual migration scope missing');

            const changeAmount = vi.spyOn(seeded.fake, 'changeAmount');
            const before = await subscriptionSnapshot(seeded.predecessor.id);
            const day = (value: string) => ({ now: () => localDayInstant(value) });
            for (const intermediate of ['2026-12-11', '2027-03-11', '2027-07-11']) {
                const now = localDayInstant(intermediate);
                expect(
                    await db.transaction((tx) =>
                        applyPlanMigrationUpcomingNotice({
                            tx,
                            planMigrationSubscriptionId: scope.id,
                            now
                        })
                    )
                ).toEqual({ outcome: 'NOT_DUE', milestone: null, recalculated: false });
                expect(await runS37(scope.id, seeded.provider, day(intermediate))).toEqual({
                    outcome: 'NOT_DUE',
                    reason: 'NOT_YET_DUE'
                });
                expect(changeAmount).toHaveBeenCalledTimes(0);
                expect(await subscriptionSnapshot(seeded.predecessor.id)).toEqual(before);
                expect(await queueRows(seeded.predecessor.id)).toEqual([]);
            }

            expect(getLocalDateString({ instant: scope.applicationDate })).toBe('2027-08-11');
        });
    }
);
