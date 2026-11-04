import { coveredPeriods, eq, payments } from '@repo/db';
import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture } from './support/refund-confirm-fixtures.js';
import { confirmedExecuteFixture, executeRows } from './support/refund-execute-fixtures.js';

afterAll(closeServiceTestPool);

type Seeded = Awaited<ReturnType<typeof confirmedExecuteFixture>>;

async function paymentNotice(seeded: Seeded) {
    seeded.fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    const deliveries = seeded.fixture.provider.takeDeliveries().deliveries;
    for (const delivery of deliveries) {
        const notice = await seeded.fixture.provider.decodeNotice(delivery);
        if (notice.resourceKind === 'charge' && notice.resourceId === seeded.charge.chargeId)
            return delivery;
    }
    throw new Error('Payment refund notice missing');
}

function receive(
    seeded: Seeded,
    delivery: Awaited<ReturnType<typeof paymentNotice>>,
    provider: PaymentProvider
) {
    return processProviderNotice(
        { channel: 'WEBHOOKS', delivery },
        {
            provider,
            clock: seeded.fixture.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            coverageNotices: seeded.fixture.coverageNotices,
            promoCharges: seeded.fixture.promoCharges,
            promoExhaustion: seeded.fixture.promoExhaustion,
            rateLimitDeferral: { coolDownRemainingMs: () => 36_001 }
        }
    );
}

function proxyProvider(
    provider: PaymentProvider,
    overrides: Partial<PaymentProvider>
): PaymentProvider {
    return new Proxy(provider, {
        get(target, key, receiver) {
            const override = Reflect.get(overrides, key) as unknown;
            if (override !== undefined) return override;
            const value = Reflect.get(target, key, receiver) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
}

describe('HOS-1552 RF3 notice under enforce deferral', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'acks a rate limited RF3 after recording and retries on the same notice without duplicate rows',
        async () => {
            const seeded = await confirmedExecuteFixture();
            const delivery = await paymentNotice(seeded);
            let reads = 0;
            const provider = proxyProvider(seeded.fixture.provider, {
                readCharge: async (input) => {
                    reads += 1;
                    if (reads === 2)
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'read',
                            message: '429 during RF3',
                            transient: { kind: 'RATE_LIMITED', retryAfterSeconds: 30 }
                        });
                    return seeded.fixture.provider.readCharge(input);
                }
            });
            const db = getServiceTestDb();
            const paymentRows = () =>
                db
                    .select()
                    .from(payments)
                    .where(eq(payments.providerFactId, seeded.charge.chargeId));
            const periods = () =>
                db
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, seeded.payment.id));
            const beforePayments = await paymentRows();
            const beforePeriods = await periods();

            const first = await receive(seeded, delivery, provider);
            const firstRows = await executeRows(seeded.refundId, seeded.payment.id);
            const firstPayments = await paymentRows();
            const firstPeriods = await periods();
            expect(first.ack).toBe('OK');
            expect(first.outcome).not.toBe('DEFERRED');
            expect(reads).toBe(2);
            expect(firstRows.refund?.status).toBe('CONFIRMED');
            expect(firstRows.payment).toBeDefined();
            expect(firstPayments).toHaveLength(beforePayments.length);
            expect(firstPeriods).toHaveLength(beforePeriods.length);

            const second = await receive(seeded, delivery, provider);
            const secondRows = await executeRows(seeded.refundId, seeded.payment.id);
            expect(second.ack).toBe('OK');
            expect(reads).toBe(4);
            expect(secondRows.refund?.status).toBe('EXECUTED');
            expect(await paymentRows()).toHaveLength(firstPayments.length);
            expect(await periods()).toHaveLength(firstPeriods.length);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'rereads after an applied refund POST whose response was lost, without a second POST',
        async () => {
            const base = await refundConfirmFixture(10000, 10000);
            let refundPosts = 0;
            const provider = proxyProvider(base.fixture.provider, {
                refund: async (input) => {
                    refundPosts += 1;
                    await base.fixture.provider.refund(input);
                    throw new PaymentProviderError({
                        code: 'UNAVAILABLE',
                        capability: 'refund',
                        message: 'Response lost after refund POST',
                        transient: { kind: 'UNAVAILABLE' }
                    });
                }
            });
            const confirmation = await confirmRefund(
                { actor: base.actor, refundId: base.refundId },
                { clock: base.fixture.clock, provider }
            );
            expect(confirmation.outcome).toBe('AWAITING_PROVIDER_ANSWER');
            expect(refundPosts).toBe(1);
            const seeded = { ...base, confirmation };
            const delivery = await paymentNotice(seeded);
            let reads = 0;
            const receivingProvider = proxyProvider(provider, {
                readCharge: async (input) => {
                    reads += 1;
                    return base.fixture.provider.readCharge(input);
                }
            });

            expect((await receive(seeded, delivery, receivingProvider)).ack).toBe('OK');
            expect((await receive(seeded, delivery, receivingProvider)).ack).toBe('OK');
            const after = await executeRows(base.refundId, base.payment.id);
            expect(reads).toBe(4);
            expect(refundPosts).toBe(1);
            expect(after.refund?.status).toBe('CONFIRMED');
        }
    );
});
