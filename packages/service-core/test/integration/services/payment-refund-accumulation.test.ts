import { coveredPeriods, eq, manualPayments, payments, refunds } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { applyExecutedRefund } from '../../../src/services/billing/payment/apply-executed-refund.service.js';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);

async function creditedPayment(amount = 10000) {
    const fixture = await paymentFixture();
    const [pending] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `refund-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!pending) throw new Error('refund payment missing');
    await creditPayment(
        { paymentId: pending.id, chargeCreatedAt: fixture.clock.now() },
        { clock: fixture.clock }
    );
    return { fixture, payment: pending };
}

async function seedRefund(input: {
    paymentId?: string | null;
    manualPaymentId?: string | null;
    amount: number;
    status: 'REQUESTED' | 'CONFIRMED' | 'EXECUTED' | 'FAILED';
}) {
    const [refund] = await getServiceTestDb()
        .insert(refunds)
        .values({
            paymentId: input.paymentId ?? null,
            manualPaymentId: input.manualPaymentId ?? null,
            amount: input.amount,
            reason: 'CUSTOMER_REQUEST',
            status: input.status,
            executedVia: input.status === 'EXECUTED' ? 'EXTERNAL' : null
        })
        .returning();
    if (!refund) throw new Error('refund seed missing');
    return refund;
}

describe('TEST:B5:4 executed refund accumulation', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'only executed refunds move the accumulation',
        async () => {
            const { fixture, payment } = await creditedPayment();
            const pending = await seedRefund({
                paymentId: payment.id,
                amount: 1000,
                status: 'REQUESTED'
            });
            const confirmed = await seedRefund({
                paymentId: payment.id,
                amount: 1000,
                status: 'CONFIRMED'
            });
            const failed = await seedRefund({
                paymentId: payment.id,
                amount: 1000,
                status: 'FAILED'
            });
            for (const refund of [pending, confirmed, failed])
                expect(
                    await applyExecutedRefund({ refundId: refund.id }, { clock: fixture.clock })
                ).toEqual({ outcome: 'REFUND_NOT_EXECUTED' });
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(after).toMatchObject({
                status: 'SUCCEEDED',
                refundedAmount: 0,
                version: payment.version + 1
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'P3 releases full coverage and permits another payment for the period',
        async () => {
            const { fixture, payment } = await creditedPayment();
            const [coverage] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment.id));
            const total = await seedRefund({
                paymentId: payment.id,
                amount: 10000,
                status: 'EXECUTED'
            });
            expect(
                await applyExecutedRefund({ refundId: total.id }, { clock: fixture.clock })
            ).toMatchObject({
                outcome: 'P3',
                refundedAmount: 10000,
                status: 'REFUNDED',
                coverageReleased: true
            });
            const [released] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.id, coverage!.id));
            expect(released?.releasedAt).toEqual(fixture.clock.now());
            const [newPayment] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: payment.subscriptionId,
                    amount: 10000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: fixture.link.provider,
                    providerFactId: `refund-replacement-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const accepted = await getServiceTestDb()
                .insert(coveredPeriods)
                .values({
                    subscriptionId: payment.subscriptionId!,
                    periodStart: coverage!.periodStart,
                    paymentId: newPayment!.id,
                    creditedAt: fixture.clock.now()
                })
                .returning();
            expect(accepted).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'P4 leaves coverage open and P5 accumulates to a full release, ignoring nonexecuted rows',
        async () => {
            const { fixture, payment } = await creditedPayment();
            const [coverage] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment.id));
            const first = await seedRefund({
                paymentId: payment.id,
                amount: 3000,
                status: 'EXECUTED'
            });
            expect(
                await applyExecutedRefund({ refundId: first.id }, { clock: fixture.clock })
            ).toMatchObject({
                outcome: 'P4',
                refundedAmount: 3000,
                status: 'PARTIALLY_REFUNDED',
                coverageReleased: false
            });
            await seedRefund({ paymentId: payment.id, amount: 1000, status: 'REQUESTED' });
            await seedRefund({ paymentId: payment.id, amount: 1000, status: 'FAILED' });
            const second = await seedRefund({
                paymentId: payment.id,
                amount: 2000,
                status: 'EXECUTED'
            });
            expect(
                await applyExecutedRefund({ refundId: second.id }, { clock: fixture.clock })
            ).toMatchObject({
                outcome: 'P5',
                refundedAmount: 5000,
                status: 'PARTIALLY_REFUNDED',
                coverageReleased: false
            });
            const [stillOpen] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.id, coverage!.id));
            expect(stillOpen?.releasedAt).toBeNull();
            const final = await seedRefund({
                paymentId: payment.id,
                amount: 5000,
                status: 'EXECUTED'
            });
            expect(
                await applyExecutedRefund({ refundId: final.id }, { clock: fixture.clock })
            ).toMatchObject({
                outcome: 'P5',
                refundedAmount: 10000,
                status: 'REFUNDED',
                coverageReleased: true
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'rejects over-refunds atomically and is idempotent',
        async () => {
            const { fixture, payment } = await creditedPayment();
            const one = await seedRefund({
                paymentId: payment.id,
                amount: 7000,
                status: 'EXECUTED'
            });
            await seedRefund({ paymentId: payment.id, amount: 5000, status: 'EXECUTED' });
            await expect(
                applyExecutedRefund({ refundId: one.id }, { clock: fixture.clock })
            ).rejects.toMatchObject({ reason: 'REFUND_EXCEEDS_PAYMENT' });
            const [unchanged] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(unchanged).toMatchObject({
                status: 'SUCCEEDED',
                refundedAmount: 0,
                version: payment.version + 1
            });

            const { fixture: secondFixture, payment: secondPayment } = await creditedPayment();
            const total = await seedRefund({
                paymentId: secondPayment.id,
                amount: 10000,
                status: 'EXECUTED'
            });
            await applyExecutedRefund({ refundId: total.id }, { clock: secondFixture.clock });
            const [beforeRepeat] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, secondPayment.id));
            expect(
                await applyExecutedRefund({ refundId: total.id }, { clock: secondFixture.clock })
            ).toEqual({ outcome: 'ALREADY_APPLIED' });
            const [afterRepeat] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, secondPayment.id));
            expect(afterRepeat?.version).toBe(beforeRepeat?.version);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'supports addon and manual payment refunds and an outer transaction',
        async () => {
            const { fixture, payment } = await creditedPayment();
            const addonId = (
                await getServiceTestPool().query<{ id: string }>(
                    'INSERT INTO addon (slug, name) VALUES ($1, $2) RETURNING id',
                    [`refund-addon-${crypto.randomUUID()}`, 'Refund addon']
                )
            ).rows[0]?.id;
            const versionId = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
                    [addonId]
                )
            ).rows[0]?.id;
            const productId = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 10000, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
                    [versionId, addonId]
                )
            ).rows[0]?.id;
            const addonInstanceId = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
                    [productId, versionId, fixture.user.id]
                )
            ).rows[0]?.id;
            if (!addonInstanceId) throw new Error('addon instance missing');
            const [addonPayment] = await getServiceTestDb()
                .insert(payments)
                .values({
                    addonInstanceId,
                    amount: 10000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: fixture.link.provider,
                    providerFactId: `refund-addon-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const addonRefund = await seedRefund({
                paymentId: addonPayment!.id,
                amount: 10000,
                status: 'EXECUTED'
            });
            expect(
                await applyExecutedRefund({ refundId: addonRefund.id }, { clock: fixture.clock })
            ).toMatchObject({ outcome: 'P3', status: 'REFUNDED', coverageReleased: false });
            const manual = await getServiceTestDb()
                .insert(manualPayments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: fixture.clock.now(),
                    status: 'REGISTERED',
                    registeredBy: fixture.user.id,
                    registeredAt: fixture.clock.now()
                })
                .returning();
            const manualRefund = await seedRefund({
                manualPaymentId: manual[0]!.id,
                amount: 1000,
                status: 'EXECUTED'
            });
            expect(
                await applyExecutedRefund({ refundId: manualRefund.id }, { clock: fixture.clock })
            ).toEqual({ outcome: 'NOT_A_PROVIDER_PAYMENT' });
            const outerRefund = await seedRefund({
                paymentId: payment.id,
                amount: 1000,
                status: 'EXECUTED'
            });
            await expect(
                getServiceTestDb().transaction(async (tx) => {
                    await applyExecutedRefund(
                        { refundId: outerRefund.id },
                        { clock: fixture.clock, tx: tx as import('@repo/db').DrizzleClient }
                    );
                    throw new Error('rollback outer transaction');
                })
            ).rejects.toThrow('rollback outer transaction');
            const [unchanged] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(unchanged).toMatchObject({ status: 'SUCCEEDED', refundedAmount: 0 });
        }
    );
});
