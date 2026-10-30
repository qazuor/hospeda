import {
    and,
    domainEventModel,
    eq,
    isNull,
    payments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

afterAll(closeServiceTestPool);
const seeded: Array<{ subscriptionId: string; userId: string }> = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of seeded.splice(0)) {
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: row.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, row.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
});

async function assertEvent(subscriptionId: string, paymentId: string, condition: number) {
    const events = await domainEventModel.findByCorrelationId({ correlationId: paymentId });
    const event = events.find(
        (candidate) =>
            candidate.eventType === 'reconciliation.mark_opened' &&
            candidate.entityId === subscriptionId &&
            candidate.changes.some(
                (change) =>
                    change.field === 'reconciliation_mark.reason' &&
                    change.new === 'PAGO_TARDIO_RECHAZADO'
            )
    );
    expect(event).toBeDefined();
    expect(event?.changes).toEqual(
        expect.arrayContaining([
            { field: 'reconciliation_mark.id', new: expect.any(String) },
            { field: 'reconciliation_mark.reason', new: 'PAGO_TARDIO_RECHAZADO' },
            { field: 'reconciliation_mark.outcome', new: expect.any(String) },
            { field: 'late_payment.failed_condition', new: condition }
        ])
    );
    const [mark] = await getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    expect(mark?.reason).toBe('PAGO_TARDIO_RECHAZADO');
    expect(mark && Object.keys(mark)).toEqual([
        'id',
        'subscriptionId',
        'addonInstanceId',
        'reason',
        'placedAt',
        'liftedAt',
        'liftedBy',
        'version',
        'deadlinesVersion',
        'escalatedAt'
    ]);
}

describe('TEST:1620:4 S5 and S7 write the failed late-payment condition', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'S5 records condition 2 without changing the mark shape',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            seeded.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await fixture.provider.changeAmount({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 300000, currency: 'ARS' }
            });
            fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            if (!payment) throw new Error('Expected the test payment');
            await assertEvent(fixture.started.subscriptionId, payment.id, 2);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'S5 records condition 3 when another principal is live',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            seeded.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            const [own] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!own) throw new Error('Expected the test subscription');
            const [retired] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: fixture.user.id,
                    vertical: own.vertical,
                    planVersionId: own.planVersionId,
                    billingOptionId: own.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'CANCELLED'
                })
                .returning();
            if (!retired) throw new Error('Expected the retired principal');
            const [other] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: fixture.user.id,
                    vertical: own.vertical,
                    planVersionId: own.planVersionId,
                    billingOptionId: own.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'PENDING_AUTHORIZATION',
                    succeedsId: retired.id
                })
                .returning();
            if (!other) throw new Error('Expected the seeded live successor');
            seeded.push(
                { subscriptionId: retired.id, userId: fixture.user.id },
                { subscriptionId: other.id, userId: fixture.user.id }
            );
            fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            if (!payment) throw new Error('Expected the test payment');
            await assertEvent(fixture.started.subscriptionId, payment.id, 3);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'S7 records its failed verdict and NO_ANCHOR condition 4',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            seeded.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            await fixture.provider.changeAmount({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 300000, currency: 'ARS' }
            });
            fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            const { payments } = await import('@repo/db');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            if (!payment) throw new Error('Expected the test payment');
            await assertEvent(fixture.started.subscriptionId, payment.id, 2);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'S7 fails closed without an anchor and records condition 4',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            seeded.push({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED', graceStartedAt: null, graceEndsAt: null })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            if (!payment) throw new Error('Expected the test payment');
            await assertEvent(fixture.started.subscriptionId, payment.id, 4);
        }
    );
});
