import { addonInstances, eq, payments, receipts } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimeOrder } from '../../../src/services/billing/addon/addon-instance-a2-one-time';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { sendOneTimeOrder } from '../../../src/services/billing/addon/send-one-time-order.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:4 AC:B10:3 one-time addon order', () => {
    async function setup() {
        const f = await purchaseFixture();
        await payingPrincipal(f);
        const input = f.input();
        const bought = await purchaseAddon(input, f.ports);
        if (bought.outcome !== 'CREATED') throw new Error(`Purchase returned ${bought.outcome}`);
        const payment = {
            token: `card-${crypto.randomUUID()}`,
            brand: 'visa',
            kind: 'credit' as const
        };
        return { f, input, bought, payment };
    }

    it.skipIf(!isServiceTestDbAvailable())(
        'credits one instance payment with a 30-day end and a receipt',
        async () => {
            const { f, input, bought, payment } = await setup();
            const charged = await sendOneTimeOrder(
                { orderRequestId: input.orderRequestId, payerEmail: 'payer@example.test', payment },
                f.ports
            );
            expect(charged.outcome).toBe('ORDER_PLACED');
            const first = await confirmOneTimeOrder({ instanceId: bought.instanceId }, f.ports);
            expect(first).toMatchObject({ outcome: 'ACTIVATED', paymentId: expect.any(String) });
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            expect(instance).toMatchObject({
                status: 'ACTIVE',
                startsAt: expect.any(Date),
                endsAt: expect.any(Date)
            });
            expect((instance?.endsAt?.getTime() ?? 0) - (instance?.startsAt?.getTime() ?? 0)).toBe(
                30 * 86_400_000
            );
            const rows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.addonInstanceId, bought.instanceId));
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                id: first.outcome === 'ACTIVATED' ? first.paymentId : '',
                addonInstanceId: bought.instanceId,
                subscriptionId: null,
                status: 'SUCCEEDED'
            });
            const issued = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.paymentId, rows[0]!.id));
            expect(issued).toHaveLength(1);
            const again = await sendOneTimeOrder(
                { orderRequestId: input.orderRequestId, payerEmail: 'payer@example.test', payment },
                f.ports
            );
            expect(again.outcome).toBe('NOT_APPLICABLE');
            expect(await confirmOneTimeOrder({ instanceId: bought.instanceId }, f.ports)).toEqual({
                outcome: 'NOT_APPLICABLE'
            });
            expect(f.fake.ordersFor({ reference: input.orderRequestId })).toEqual({
                orders: 1,
                paid: 1
            });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(payments)
                    .where(eq(payments.addonInstanceId, bought.instanceId))
            ).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('keeps an unapproved order pending', async () => {
        const { f, input, bought, payment } = await setup();
        f.fake.declineOrderPayments({ paymentToken: payment.token });
        const charged = await sendOneTimeOrder(
            { orderRequestId: input.orderRequestId, payerEmail: 'payer@example.test', payment },
            f.ports
        );
        expect(charged.outcome).toBe('ORDER_DECLINED');
        expect(await confirmOneTimeOrder({ instanceId: bought.instanceId }, f.ports)).toEqual({
            outcome: 'NOT_APPROVED'
        });
        const [instance] = await getServiceTestDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, bought.instanceId));
        expect(instance?.status).toBe('PENDING_AUTHORIZATION');
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.addonInstanceId, bought.instanceId))
        ).toHaveLength(0);
    });

    it.skipIf(!isServiceTestDbAvailable())('reuses an already recorded payment fact', async () => {
        const { f, input, bought, payment } = await setup();
        const sent = await sendOneTimeOrder(
            { orderRequestId: input.orderRequestId, payerEmail: 'payer@example.test', payment },
            f.ports
        );
        if (!sent.orderId) throw new Error('Order missing');
        const { snapshot } = await f.fake.readOrder({ orderId: sent.orderId });
        if (!snapshot.paymentTransactionId) throw new Error('Order payment missing');
        // A provider payment fact is seeded to simulate a retry after a prior insert.
        const [seeded] = await getServiceTestDb()
            .insert(payments)
            .values({
                addonInstanceId: bought.instanceId,
                subscriptionId: null,
                amount: 5000,
                currency: 'ARS',
                status: 'PENDING',
                provider: 'MERCADO_PAGO',
                providerFactId: snapshot.paymentTransactionId,
                providerPaymentId: snapshot.paymentTransactionId,
                factAt: f.ports.clock.now()
            })
            .returning({ id: payments.id });
        expect(await confirmOneTimeOrder({ instanceId: bought.instanceId }, f.ports)).toEqual({
            outcome: 'ACTIVATED',
            paymentId: seeded?.id
        });
        const rows = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.addonInstanceId, bought.instanceId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('SUCCEEDED');
    });

    it.skipIf(!isServiceTestDbAvailable())(
        'returns UNKNOWN without writing when order read fails',
        async () => {
            const { f, input, bought, payment } = await setup();
            await sendOneTimeOrder(
                { orderRequestId: input.orderRequestId, payerEmail: 'payer@example.test', payment },
                f.ports
            );
            vi.spyOn(f.fake, 'readOrder').mockRejectedValueOnce(new Error('network cut'));
            expect(await confirmOneTimeOrder({ instanceId: bought.instanceId }, f.ports)).toEqual({
                outcome: 'UNKNOWN'
            });
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            expect(instance?.status).toBe('PENDING_AUTHORIZATION');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(payments)
                    .where(eq(payments.addonInstanceId, bought.instanceId))
            ).toHaveLength(0);
        }
    );
});
