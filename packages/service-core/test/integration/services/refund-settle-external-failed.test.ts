import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundFailFixture, refundFailRows } from './support/refund-fail-fixtures.js';
import {
    paymentRow,
    refundById,
    refundsOfPayment,
    seedAdminActor
} from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

async function failedRefundFixture(amount = 10000, refundAmount = amount) {
    const seeded = await refundFailFixture(amount, refundAmount);
    const provider = new Proxy(seeded.fixture.provider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async () => {
                    throw new PaymentProviderError({
                        code: 'REJECTED',
                        capability: 'refund',
                        message: 'Mercado Pago request failed (401)',
                        cause: {
                            status: 401,
                            body: { message: 'Unauthorized use of live credentials' }
                        }
                    });
                };
            return Reflect.get(target, property, receiver);
        }
    });
    await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider }
    );
    return { ...seeded, admin: await seedAdminActor() };
}

describe('HOS-2301 RF4 answers provider-rejected FAILED refunds', () => {
    it.skipIf(skip)(
        'records a new EXECUTED refund and leaves the FAILED row untouched',
        async () => {
            const seeded = await failedRefundFixture();
            const failedBefore = await refundById(seeded.refundId);

            const settled = await settleExternalRefund(
                {
                    actor: seeded.admin,
                    source: { kind: 'PAYMENT', id: seeded.payment.id },
                    amount: 10000,
                    channel: 'PROVIDER_PANEL',
                    reference: `panel-${crypto.randomUUID()}`,
                    reason: 'OUT_OF_FLOW_REFUND',
                    refundId: seeded.refundId
                },
                { clock: seeded.fixture.clock }
            );

            expect(settled).toMatchObject({
                settledFailedRefundId: seeded.refundId,
                closedRequestedRefundId: null,
                paymentOutcome: 'P3'
            });
            expect(await refundById(seeded.refundId)).toEqual(failedBefore);
            expect(await refundsOfPayment(seeded.payment.id)).toHaveLength(2);
            expect(await refundById(settled.refundId)).toMatchObject({
                status: 'EXECUTED',
                executedVia: 'EXTERNAL'
            });
            expect(await paymentRow(seeded.payment.id)).toMatchObject({
                status: 'REFUNDED',
                refundedAmount: 10000
            });
        }
    );

    it.skipIf(skip)('does not close a different REQUESTED refund on the same payment', async () => {
        const seeded = await failedRefundFixture(20000, 10000);
        const requested = await requestRefund(
            {
                source: { kind: 'PAYMENT', id: seeded.payment.id },
                amount: 5000,
                reason: 'MARK_PROPOSAL'
            },
            { clock: seeded.fixture.clock }
        );

        const settled = await settleExternalRefund(
            {
                actor: seeded.admin,
                source: { kind: 'PAYMENT', id: seeded.payment.id },
                amount: 10000,
                channel: 'PROVIDER_PANEL',
                reference: `panel-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND',
                refundId: seeded.refundId
            },
            { clock: seeded.fixture.clock }
        );

        expect(settled).toMatchObject({
            settledFailedRefundId: seeded.refundId,
            closedRequestedRefundId: null
        });
        expect((await refundById(requested.refundId))?.status).toBe('REQUESTED');
        expect(
            (
                await refundFailRows({
                    refundId: seeded.refundId,
                    paymentId: seeded.payment.id,
                    recipientId: seeded.actor.id
                })
            ).refund?.status
        ).toBe('FAILED');
    });
});
