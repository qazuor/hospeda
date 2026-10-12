import { coveredPeriods, emailOutbox, eq, payments, receipts, subscriptions } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { failPayment } from '../../../src/services/billing/payment/fail-payment.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

async function pendingPayment(fixture: Awaited<ReturnType<typeof paymentFixture>>) {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `window-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!payment) throw new Error('pending payment missing');
    return payment;
}

describe('TEST:B5:4 payment window expiration', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'P2 fails the pending payment without changing its subscription or side effects',
        async () => {
            const fixture = await paymentFixture();
            const first = await pendingPayment(fixture);
            await creditPayment(
                { paymentId: first.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            const payment = await pendingPayment(fixture);
            const [subscriptionBefore] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const result = await failPayment({ paymentId: payment.id }, { clock: fixture.clock });
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            const [subscriptionAfter] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(result).toEqual({ outcome: 'FAILED' });
            expect(after).toMatchObject({ status: 'FAILED', version: payment.version + 1 });
            expect(subscriptionAfter).toEqual(subscriptionBefore);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id))
            ).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment.id))
            ).toHaveLength(0);
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(
                mail.filter(
                    (row) => (row.payload as { paymentId?: string }).paymentId === payment.id
                )
            ).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'P2 is idempotent for a succeeded payment and concurrent callers',
        async () => {
            const fixture = await paymentFixture();
            const [succeeded] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: fixture.link.provider,
                    providerFactId: `window-succeeded-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            expect(
                await failPayment({ paymentId: succeeded!.id }, { clock: fixture.clock })
            ).toEqual({ outcome: 'NOT_PENDING' });
            const [unchangedSucceeded] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, succeeded!.id));
            expect(unchangedSucceeded).toEqual(succeeded);
            const payment = await pendingPayment(fixture);
            const results = await Promise.all([
                failPayment({ paymentId: payment.id }, { clock: fixture.clock }),
                failPayment({ paymentId: payment.id }, { clock: fixture.clock })
            ]);
            expect(results.map((row) => row.outcome).sort()).toEqual(['FAILED', 'NOT_PENDING']);
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(after).toMatchObject({ status: 'FAILED', version: payment.version + 1 });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'FAILED blocks later P1 and a rejected fact remains pending until an explicit P2 call',
        async () => {
            const fixture = await paymentFixture();
            const payment = await pendingPayment(fixture);
            await failPayment({ paymentId: payment.id }, { clock: fixture.clock });
            expect(
                await creditPayment(
                    { paymentId: payment.id, chargeCreatedAt: fixture.clock.now() },
                    { clock: fixture.clock }
                )
            ).toMatchObject({ outcome: 'NOT_PENDING' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id))
            ).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment.id))
            ).toHaveLength(0);

            const { chargeId } = await fixture.provider.declineCharge({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'declined'
            });
            const recorded = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(recorded.outcome).toBe('DECLINED');
            const [rejectedPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(rejectedPayment).toMatchObject({ status: 'PENDING', version: 1 });
        }
    );
});
