import { eq, refundCalls } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { confirmedExecuteFixture, executeRows } from './support/refund-execute-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

async function refundNotice(seeded: Awaited<ReturnType<typeof confirmedExecuteFixture>>) {
    seeded.fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    const deliveries = seeded.fixture.provider.takeDeliveries().deliveries;
    const matches = [];
    for (const delivery of deliveries) {
        const decoded = await seeded.fixture.provider.decodeNotice(delivery);
        if (decoded.resourceKind === 'charge' && decoded.resourceId === seeded.charge.chargeId)
            matches.push(delivery);
    }
    expect(matches.length).toBeGreaterThan(0);
    return matches.at(-1)!;
}

function receive(
    seeded: Awaited<ReturnType<typeof confirmedExecuteFixture>>,
    delivery: Awaited<ReturnType<typeof refundNotice>>,
    provider: PaymentProvider = seeded.fixture.provider
) {
    return processProviderNotice(
        { channel: 'WEBHOOKS', delivery },
        {
            provider,
            clock: seeded.fixture.clock,
            beforeCancelNotice,
            coverageNotices: seeded.fixture.coverageNotices,
            promoCharges: seeded.fixture.promoCharges,
            promoExhaustion: seeded.fixture.promoExhaustion
        }
    );
}

describe('AC:B6:5 RF3 after a payment refund notice', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'executes two accredited parts through P4 once',
        async () => {
            const seeded = await confirmedExecuteFixture();
            const before = await executeRows(seeded.refundId, seeded.payment.id);
            expect(before.calls.filter((call) => call.providerRefundId !== null)).toHaveLength(2);
            const delivery = await refundNotice(seeded);

            const first = await receive(seeded, delivery);
            const after = await executeRows(seeded.refundId, seeded.payment.id);
            const repeated = await receive(seeded, delivery);
            const again = await executeRows(seeded.refundId, seeded.payment.id);

            expect(first.ack).toBe('OK');
            expect(after.refund).toMatchObject({ status: 'EXECUTED', executedVia: 'PROVIDER' });
            expect(after.payment).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 5000,
                version: before.payment!.version + 1
            });
            expect(repeated.ack).toBe('OK');
            expect(again.payment).toMatchObject({
                status: after.payment!.status,
                refundedAmount: after.payment!.refundedAmount,
                version: after.payment!.version
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'keeps a row confirmed when one own part is rejected',
        async () => {
            const seeded = await confirmedExecuteFixture();
            const accepted = (
                await getServiceTestDb()
                    .select()
                    .from(refundCalls)
                    .where(eq(refundCalls.refundId, seeded.refundId))
            ).filter((call) => call.providerRefundId !== null);
            expect(accepted).toHaveLength(2);
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: accepted[1]!.providerRefundId!
            });
            const before = await executeRows(seeded.refundId, seeded.payment.id);
            const delivery = await refundNotice(seeded);

            const result = await receive(seeded, delivery);
            const after = await executeRows(seeded.refundId, seeded.payment.id);

            expect(result.ack).toBe('OK');
            expect(after.refund?.status).toBe('CONFIRMED');
            expect(after.payment).toMatchObject({
                status: before.payment!.status,
                refundedAmount: before.payment!.refundedAmount,
                version: before.payment!.version
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'acknowledges a notice when RF3 reread fails',
        async () => {
            const seeded = await confirmedExecuteFixture();
            const delivery = await refundNotice(seeded);
            let reads = 0;
            const provider = new Proxy(seeded.fixture.provider as PaymentProvider, {
                get(target, key, receiver) {
                    if (key === 'readCharge')
                        return async (input: Parameters<PaymentProvider['readCharge']>[0]) => {
                            reads += 1;
                            if (reads > 1) throw new Error('RF3 reread unavailable');
                            return target.readCharge(input);
                        };
                    const value = Reflect.get(target, key, receiver) as unknown;
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });

            const result = await receive(seeded, delivery, provider);
            const after = await executeRows(seeded.refundId, seeded.payment.id);

            expect(result.ack).toBe('OK');
            expect(reads).toBe(2);
            expect(after.refund?.status).toBe('CONFIRMED');
        }
    );
});
