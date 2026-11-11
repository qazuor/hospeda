import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    promoRedemptions,
    subscriptionScheduledChanges
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { composePromoAmount } from '../../../src/services/billing/promo/promo-composition.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import {
    cleanupIncreaseCases,
    createS37IncreaseCase,
    S37_INCREASE_TARGET_AMOUNT_MINOR
} from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    S37_DAY,
    S37_NEXT_CHARGE_AT
} from './support/plan-migration-s37-fixtures.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
/** S37_DAY is seven local days before the seeded next charge day. */
const APPLICATION_DAY = '2026-12-11';

afterEach(async () => {
    // Every case fixture drops its own participation rows first; the retirement
    // cleanup is the one that finally retires the shared subscriptions/users.
    await cleanupIncreaseCases();
    await cleanupS37Cases();
});
afterAll(closeServiceTestPool);

interface S37Runnable {
    readonly scope: { readonly id: string };
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}

function run(caseRow: S37Runnable) {
    return runPlanMigrationS37ForRow(
        { planMigrationSubscriptionId: caseRow.scope.id, correlationId: crypto.randomUUID() },
        { provider: caseRow.provider, clock: caseRow.clock }
    );
}

function upcomingKey(recipientUserId: string, scopeId: string) {
    return planMigrationNoticeDedupKey({
        recipientUserId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: scopeId,
        milestone: 'mig:-7d',
        targetDate: APPLICATION_DAY
    });
}

async function markNoticeSent(recipientUserId: string, scopeId: string) {
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, upcomingKey(recipientUserId, scopeId)));
}

async function queueRows(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

async function scopeRow(scopeId: string) {
    const [row] = await db
        .select({
            status: planMigrationSubscriptions.status,
            appliedAt: planMigrationSubscriptions.appliedAt
        })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, scopeId));
    return row;
}

async function redemption(promoId: string) {
    const [row] = await db
        .select({ remainingCharges: promoRedemptions.remainingCharges })
        .from(promoRedemptions)
        .where(eq(promoRedemptions.id, promoId));
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

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:10 AC:B12:9 S37 con el motivo «aumento»: muta siete días antes, verificado releyendo, y conserva la promo viva',
    () => {
        it('siete días antes muta al precio sembrado, lo relee, registra a quién se aplicó y encola la versión nueva', async () => {
            const caseRow = await createS37IncreaseCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow.userId, caseRow.scope.id);
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            expect(await run(caseRow)).toEqual({ outcome: 'APPLIED_CARD', escalated: false });
            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(changeAmount).toHaveBeenCalledWith({
                authorizationId: caseRow.authorizationId,
                amount: { amountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR, currency: 'ARS' }
            });
            vi.restoreAllMocks();
            const reread = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(reread.snapshot.amount).toEqual({
                amountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
                currency: 'ARS'
            });

            const events = await decisions(caseRow.subscriptionId);
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                reason: 'S37',
                eventType: 'subscription.amount_mutation_decided',
                entityType: 'subscription',
                entityId: caseRow.subscriptionId
            });
            expect(events[0]?.changes).toEqual([
                { field: 'plan_migration_subscription.id', new: caseRow.scope.id },
                { field: 'subscription.transaction_amount', new: 'migration_target_list_price' }
            ]);

            expect(await scopeRow(caseRow.scope.id)).toEqual({
                status: 'APLICADA',
                appliedAt: S37_DAY
            });
            const queue = await queueRows(caseRow.subscriptionId);
            expect(queue).toHaveLength(1);
            expect(queue[0]).toMatchObject({
                subscriptionId: caseRow.subscriptionId,
                targetPlanVersionId: caseRow.targetPlanVersionId,
                targetBillingOptionId: caseRow.targetOptionId,
                planMigrationSubscriptionId: caseRow.scope.id,
                keepSelection: null
            });
            expect(queue[0]?.effectiveAt).toEqual(S37_NEXT_CHARGE_AT);
        });

        it('con una promo viva, el monto mutado es el precio nuevo menos la promo y los cobros restantes no cambian', async () => {
            const caseRow = await createS37IncreaseCase();
            const promo = await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow.userId, caseRow.scope.id);
            const before = await redemption(promo.id);
            const expected = composePromoAmount({
                listAmountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
                promos: [{ discountKind: 'FIXED', value: 1000 }]
            }).amountMinor;
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            expect(await run(caseRow)).toEqual({ outcome: 'APPLIED_CARD', escalated: false });
            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(changeAmount).toHaveBeenCalledWith({
                authorizationId: caseRow.authorizationId,
                amount: { amountMinor: expected, currency: 'ARS' }
            });
            vi.restoreAllMocks();
            expect(await redemption(promo.id)).toEqual(before);
        });

        it('manual con promo viva: aplica en un acto, escribe la cola y no toca el proveedor', async () => {
            const caseRow = await createS37IncreaseCase({ paymentMethod: 'MANUAL' });
            const promo = await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            const before = await redemption(promo.id);
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            const readAuthorization = vi.spyOn(caseRow.fake, 'readAuthorization');

            expect(await run(caseRow)).toEqual({ outcome: 'APPLIED_MANUAL' });
            expect(changeAmount).toHaveBeenCalledTimes(0);
            expect(readAuthorization).toHaveBeenCalledTimes(0);
            vi.restoreAllMocks();
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(1);
            expect(await redemption(promo.id)).toEqual(before);
            expect(await scopeRow(caseRow.scope.id)).toEqual({
                status: 'APLICADA',
                appliedAt: S37_DAY
            });
        });

        it('el retiro con promo viva sigue poniendo los cobros restantes en cero', async () => {
            const caseRow = await createS37MigrationCase({ paymentMethod: 'MANUAL' });
            const promo = await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            expect(await run(caseRow)).toEqual({ outcome: 'APPLIED_MANUAL' });
            expect(await redemption(promo.id)).toEqual({ remainingCharges: 0 });
        });

        it('el día −8 no está en la ventana: NOT_DUE y cero mutaciones del falso', async () => {
            const caseRow = await createS37IncreaseCase({
                start: new Date('2026-12-03T13:00:00.000Z')
            });
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            expect(await run(caseRow)).toEqual({ outcome: 'NOT_DUE', reason: 'NOT_YET_DUE' });
            expect(changeAmount).toHaveBeenCalledTimes(0);
            vi.restoreAllMocks();
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
        });
    }
);
