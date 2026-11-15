import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    promoRedemptions,
    providerLinks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { cleanupPlanMigrationCases } from './support/plan-migration-fixtures.js';
import {
    alignNextChargeWithApplication,
    cleanupIncreaseCases,
    createIncreaseJourney,
    INCREASE_PROMO_VALUE_MINOR,
    type IncreaseJourney,
    localDayInstant,
    S37_INCREASE_TARGET_AMOUNT_MINOR,
    shiftLocalDay
} from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
/** Announcement local day + 60: the monthly customer's charge on the deadline itself. */
const MONTHLY_NEXT_CHARGE = localDayInstant('2026-12-10');
/** Announcement local day + 40: an annual renewal inside the notice window. */
const ANNUAL_NEXT_CHARGE = localDayInstant('2026-11-20');

afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupIncreaseCases();
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

function sevenDayKey(journey: IncreaseJourney): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: journey.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: journey.scope.id,
        milestone: 'mig:-7d',
        targetDate: journey.applicationDate
    });
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

function s37(journey: IncreaseJourney) {
    return runPlanMigrationS37ForRow(
        { planMigrationSubscriptionId: journey.scope.id, correlationId: crypto.randomUUID() },
        { provider: journey.provider, clock: journey.clock }
    );
}

async function markThirdNoticeSent(journey: IncreaseJourney): Promise<void> {
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, sevenDayKey(journey)));
}

/**
 * Walks the whole announced path for one customer: reminder at -30, no mutation
 * at -8, the notice gate at -7 and the verified card mutation after it.
 */
async function driveToAppliedCard(journey: IncreaseJourney): Promise<void> {
    journey.clock.set(localDayInstant(shiftLocalDay(journey.applicationDate, -30)));
    expect(await notify(journey, 30)).toEqual({
        outcome: 'ENQUEUED',
        milestone: 'mig:-30d',
        recalculated: false
    });

    journey.clock.set(localDayInstant(shiftLocalDay(journey.applicationDate, -8)));
    expect(await s37(journey)).toEqual({ outcome: 'NOT_DUE', reason: 'NOT_YET_DUE' });

    // A real renewal before the date advances the next charge; seed that state.
    await alignNextChargeWithApplication(journey);

    journey.clock.set(localDayInstant(shiftLocalDay(journey.applicationDate, -7)));
    expect(await s37(journey)).toEqual({ outcome: 'NOTICE_PENDING' });
    await markThirdNoticeSent(journey);
    expect(await s37(journey)).toEqual({ outcome: 'APPLIED_CARD', escalated: false });
}

async function appliedScope(scopeId: string) {
    const [row] = await db
        .select({
            status: planMigrationSubscriptions.status,
            appliedAt: planMigrationSubscriptions.appliedAt
        })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, scopeId));
    return row;
}

async function decisions(subscriptionId: string) {
    return db
        .select({
            reason: domainEvent.reason,
            eventType: domainEvent.eventType,
            entityType: domainEvent.entityType,
            entityId: domainEvent.entityId,
            changes: domainEvent.changes
        })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'subscription.amount_mutation_decided')
            )
        );
}

async function redemption(redemptionId: string) {
    const [row] = await db
        .select({ remainingCharges: promoRedemptions.remainingCharges })
        .from(promoRedemptions)
        .where(eq(promoRedemptions.id, redemptionId));
    return row;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:10 AC:B12:9 el aumento anunciado, con la fecha de cada cliente — mutación y `S38`',
    () => {
        it('cláusula 6 · «la mutación se verifica releyendo y queda registrado a quién se aplicó»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE
            });

            await driveToAppliedCard(journey);

            const reread = await journey.fake.readAuthorization({
                authorizationId: journey.authorizationId
            });
            expect(reread.snapshot.amount).toEqual({
                amountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
                currency: 'ARS'
            });

            const events = await decisions(journey.subscriptionId);
            expect(events).toEqual([
                {
                    reason: 'S37',
                    eventType: 'subscription.amount_mutation_decided',
                    entityType: 'subscription',
                    entityId: journey.subscriptionId,
                    changes: [
                        { field: 'plan_migration_subscription.id', new: journey.scope.id },
                        {
                            field: 'subscription.transaction_amount',
                            new: 'migration_target_list_price'
                        }
                    ]
                }
            ]);
            expect(await appliedScope(journey.scope.id)).toEqual({
                status: 'APLICADA',
                appliedAt: localDayInstant(shiftLocalDay(journey.applicationDate, -7))
            });
        });

        it('cláusula 7 · «sobre la misma autorización, sin re-autorizar»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE
            });
            const authorize = vi.spyOn(journey.fake, 'authorize');
            const changeAmount = vi.spyOn(journey.fake, 'changeAmount');
            const [linkBefore] = await db
                .select({ providerId: providerLinks.providerId })
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, journey.subscriptionId));

            await driveToAppliedCard(journey);

            const [linkAfter] = await db
                .select({ providerId: providerLinks.providerId })
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, journey.subscriptionId));
            expect(linkBefore?.providerId).toBe(journey.authorizationId);
            expect(linkAfter?.providerId).toBe(journey.authorizationId);
            expect(authorize).toHaveBeenCalledTimes(0);
            const mutatingCalls = changeAmount.mock.calls.filter(
                ([input]) => input.authorizationId === journey.authorizationId
            );
            expect(mutatingCalls).toHaveLength(1);
        });

        it('cláusula 8 · «por S38 en la fecha, que deja la fila en la versión nueva»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'annual',
                nextChargeAt: ANNUAL_NEXT_CHARGE
            });

            await driveToAppliedCard(journey);

            const applied = await db.transaction((tx) =>
                applyScheduledChangeInTx({
                    subscriptionId: journey.subscriptionId,
                    now: localDayInstant(journey.applicationDate),
                    tx
                })
            );
            expect(applied).toMatchObject({
                outcome: 'APPLIED',
                motive: 'PRICE_INCREASE',
                toPlanVersionId: journey.targetPlanVersionId,
                toBillingOptionId: journey.targetOptionId
            });

            const [row] = await db
                .select({
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, journey.subscriptionId));
            expect(row).toEqual({
                planVersionId: journey.targetPlanVersionId,
                billingOptionId: journey.targetOptionId
            });
        });

        it('cláusula 10 · «una fila sembrada con una promo viva conserva sus cobros_restantes, con el monto mutado igual al precio nuevo menos la promo»', async () => {
            const journey = await createIncreaseJourney({
                cycle: 'monthly',
                nextChargeAt: MONTHLY_NEXT_CHARGE,
                withPromo: true
            });
            if (!journey.promo) throw new Error('Journey promo missing');
            const changeAmount = vi.spyOn(journey.fake, 'changeAmount');
            const before = await redemption(journey.promo.id);
            expect(before).toEqual({ remainingCharges: 2 });

            await driveToAppliedCard(journey);

            const mutatedAmount = S37_INCREASE_TARGET_AMOUNT_MINOR - INCREASE_PROMO_VALUE_MINOR;
            expect(
                changeAmount.mock.calls
                    .filter(([input]) => input.authorizationId === journey.authorizationId)
                    .map(([input]) => input)
            ).toEqual([
                {
                    authorizationId: journey.authorizationId,
                    amount: { amountMinor: mutatedAmount, currency: 'ARS' }
                }
            ]);
            expect(await redemption(journey.promo.id)).toEqual(before);

            await db.transaction((tx) =>
                applyScheduledChangeInTx({
                    subscriptionId: journey.subscriptionId,
                    now: localDayInstant(journey.applicationDate),
                    tx
                })
            );

            expect(await redemption(journey.promo.id)).toEqual(before);
            const [row] = await db
                .select({ planVersionId: subscriptions.planVersionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, journey.subscriptionId));
            expect(row?.planVersionId).toBe(journey.targetPlanVersionId);
        });
    }
);
