import { emailOutbox, eq, inArray, planMigrationSubscriptions, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { cleanupPlanMigrationCases } from './support/plan-migration-fixtures.js';
import {
    cleanupIncreaseCases,
    createIncreaseJourney,
    INCREASE_CURRENT_AMOUNT_MINOR,
    INCREASE_PROMO_VALUE_MINOR,
    type IncreaseJourney,
    localDayInstant,
    S37_INCREASE_TARGET_AMOUNT_MINOR,
    shiftLocalDay
} from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
const ANNOUNCED_DAY = '2026-10-11';
/** Announcement local day + 60: the monthly customer's charge on the deadline itself. */
const MONTHLY_NEXT_CHARGE = localDayInstant('2026-12-10');
/** Announcement local day + 40: an annual renewal inside the notice window. */
const ANNUAL_NEXT_CHARGE = localDayInstant('2026-11-20');
const MONTHLY_APPLICATION_DAY = '2027-01-10';
const ANNUAL_APPLICATION_DAY = '2027-11-20';

afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupIncreaseCases();
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

function announceKey(journey: IncreaseJourney): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: journey.userId,
        template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
        planMigrationSubscriptionId: journey.scope.id,
        milestone: 'mig:announce',
        targetDate: ANNOUNCED_DAY
    });
}

function upcomingKey(journey: IncreaseJourney, milestone: string): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: journey.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: journey.scope.id,
        milestone,
        targetDate: journey.applicationDate
    });
}

/** Every outbox key of the journey's own recipient, sorted. */
async function outboxKeys(journey: IncreaseJourney): Promise<string[]> {
    const rows = await db
        .select({ dedupKey: emailOutbox.dedupKey })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, journey.userId));
    return rows.map((row) => row.dedupKey).sort();
}

function notify(journey: IncreaseJourney, daysBefore: number) {
    return db.transaction((tx) =>
        applyPlanMigrationUpcomingNotice({
            tx,
            planMigrationSubscriptionId: journey.scope.id,
            now: localDayInstant(shiftLocalDay(journey.applicationDate, -daysBefore))
        })
    );
}

async function payloadAt(dedupKey: string): Promise<unknown> {
    const [row] = await db
        .select({ payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.dedupKey, dedupKey));
    return row?.payload;
}

function expectedUpcoming(
    journey: IncreaseJourney,
    daysBefore: 30 | 7,
    amounts: { readonly current: number; readonly next: number }
) {
    return {
        planMigrationId: journey.migrationId,
        planMigrationSubscriptionId: journey.scope.id,
        subscriptionId: journey.subscriptionId,
        vertical: 'accommodation',
        planName: 'Succession plan',
        targetPlanName: 'Succession plan',
        direction: 'UP',
        currentAmountMinor: amounts.current,
        newAmountMinor: amounts.next,
        currency: 'ARS',
        applicationDate: journey.applicationDate,
        daysBefore,
        losesPromo: false,
        variant: 'SCHEDULED',
        providerNotifies: daysBefore === 7,
        deadlinesVersion: journey.deadlineVersion,
        reason: 'PRICE_INCREASE'
    };
}

function expectedAnnouncement(
    journey: IncreaseJourney,
    amounts: { readonly current: number; readonly next: number }
) {
    return {
        planMigrationId: journey.migrationId,
        planMigrationSubscriptionId: journey.scope.id,
        subscriptionId: journey.subscriptionId,
        vertical: 'accommodation',
        planName: 'Succession plan',
        targetPlanName: 'Succession plan',
        direction: 'UP',
        currentAmountMinor: amounts.current,
        newAmountMinor: amounts.next,
        currency: 'ARS',
        applicationDate: journey.applicationDate,
        losesPromo: false,
        variant: 'SCHEDULED',
        deadlinesVersion: journey.deadlineVersion,
        reason: 'PRICE_INCREASE'
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:10 AC:B12:9 el aumento anunciado, con la fecha de cada cliente',
    () => {
        it('cláusula 1 · «los tres avisos se encolan en sus días»', async () => {
            const monthly = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE
            });
            const annual = await createIncreaseJourney({
                cycle: 'annual',
                nextChargeAt: ANNUAL_NEXT_CHARGE
            });

            for (const journey of [monthly, annual]) {
                expect(await outboxKeys(journey)).toEqual([announceKey(journey)]);
            }

            for (const journey of [monthly, annual]) {
                expect(await notify(journey, 31)).toEqual({
                    outcome: 'NOT_DUE',
                    milestone: null,
                    recalculated: false
                });
                expect(
                    (await outboxKeys(journey)).filter(
                        (key) => key === upcomingKey(journey, 'mig:-30d')
                    )
                ).toEqual([]);
            }

            for (const journey of [monthly, annual]) {
                expect(await notify(journey, 30)).toEqual({
                    outcome: 'ENQUEUED',
                    milestone: 'mig:-30d',
                    recalculated: false
                });
                expect(await notify(journey, 7)).toEqual({
                    outcome: 'ENQUEUED',
                    milestone: 'mig:-7d',
                    recalculated: false
                });
            }

            for (const journey of [monthly, annual]) {
                expect(await outboxKeys(journey)).toEqual(
                    [
                        announceKey(journey),
                        upcomingKey(journey, 'mig:-30d'),
                        upcomingKey(journey, 'mig:-7d')
                    ].sort()
                );
            }
        });

        it('cláusula 2 · «con el precio actual, el nuevo y la fecha de cada uno»', async () => {
            const monthly = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE,
                withPromo: true
            });
            const annual = await createIncreaseJourney({
                cycle: 'annual',
                nextChargeAt: ANNUAL_NEXT_CHARGE
            });

            for (const journey of [monthly, annual]) {
                await notify(journey, 30);
                await notify(journey, 7);
            }

            const composed = {
                current: INCREASE_CURRENT_AMOUNT_MINOR - INCREASE_PROMO_VALUE_MINOR,
                next: S37_INCREASE_TARGET_AMOUNT_MINOR - INCREASE_PROMO_VALUE_MINOR
            };
            const plain = {
                current: INCREASE_CURRENT_AMOUNT_MINOR,
                next: S37_INCREASE_TARGET_AMOUNT_MINOR
            };

            expect(await payloadAt(announceKey(monthly))).toEqual(
                expectedAnnouncement(monthly, composed)
            );
            expect(await payloadAt(upcomingKey(monthly, 'mig:-30d'))).toEqual(
                expectedUpcoming(monthly, 30, composed)
            );
            expect(await payloadAt(upcomingKey(monthly, 'mig:-7d'))).toEqual(
                expectedUpcoming(monthly, 7, composed)
            );

            expect(await payloadAt(announceKey(annual))).toEqual(
                expectedAnnouncement(annual, plain)
            );
            expect(await payloadAt(upcomingKey(annual, 'mig:-30d'))).toEqual(
                expectedUpcoming(annual, 30, plain)
            );
            expect(await payloadAt(upcomingKey(annual, 'mig:-7d'))).toEqual(
                expectedUpcoming(annual, 7, plain)
            );

            // The dates are per customer, never a global one.
            expect(monthly.applicationDate).toBe(MONTHLY_APPLICATION_DAY);
            expect(annual.applicationDate).toBe(ANNUAL_APPLICATION_DAY);
        });

        it('cláusula 3 · «el falso no recibe ninguna mutación antes de los siete días previos»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE
            });
            const changeAmount = vi.spyOn(journey.fake, 'changeAmount');
            const readAuthorization = vi.spyOn(journey.fake, 'readAuthorization');
            journey.clock.set(localDayInstant(shiftLocalDay(journey.applicationDate, -8)));

            const result = await runPlanMigrationS37ForRow(
                {
                    planMigrationSubscriptionId: journey.scope.id,
                    correlationId: crypto.randomUUID()
                },
                { provider: journey.provider, clock: journey.clock }
            );

            expect(result).toEqual({ outcome: 'NOT_DUE', reason: 'NOT_YET_DUE' });
            expect(
                changeAmount.mock.calls.filter(
                    ([input]) => input.authorizationId === journey.authorizationId
                )
            ).toHaveLength(0);
            expect(
                readAuthorization.mock.calls.filter(
                    ([input]) => input.authorizationId === journey.authorizationId
                )
            ).toHaveLength(0);
        });

        it('cláusula 4 · «al mensual el primer cobro al precio nuevo es el estrictamente posterior a los 60 días, y un cobro justo el día 60 sale al precio viejo»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE
            });

            // The seeded charge lands exactly on the 60-day deadline; the increase
            // moves to the next monthly charge, never to the charge on day 60.
            expect(journey.applicationDate).toBe(MONTHLY_APPLICATION_DAY);

            const [subscription] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, journey.subscriptionId));
            if (!subscription) throw new Error('Journey subscription missing');
            const expected = await createCutExpectedAmountPolicy().expectedAmount({
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: localDayInstant('2026-12-10') }
            });

            expect(expected).toEqual({
                kind: 'COMPARABLE',
                amountMinor: INCREASE_CURRENT_AMOUNT_MINOR,
                currency: 'ARS',
                source: 'ANCHORED'
            });
        });

        it('cláusula 5 · «al anual que renueva en menos de 60 días se le posterga a la renovación siguiente»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'annual',
                nextChargeAt: ANNUAL_NEXT_CHARGE
            });

            // Renewal 2026-11-20 (announcement + 40) is inside the 60-day window;
            // the increase waits for the next annual renewal, 12 months later.
            expect(journey.applicationDate).toBe(ANNUAL_APPLICATION_DAY);
        });

        it('cláusula 9 · «ninguna fila de alcance queda PARA_RESOLVER»', async () => {
            const monthly = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE
            });
            const annual = await createIncreaseJourney({
                cycle: 'annual',
                nextChargeAt: ANNUAL_NEXT_CHARGE
            });

            const rows = await db
                .select({ status: planMigrationSubscriptions.status })
                .from(planMigrationSubscriptions)
                .where(
                    inArray(planMigrationSubscriptions.planMigrationId, [
                        monthly.migrationId,
                        annual.migrationId
                    ])
                );

            expect(rows.map((row) => row.status).sort()).toEqual(['PENDIENTE', 'PENDIENTE']);
        });
    }
);
