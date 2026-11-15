import { PaymentProviderError } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundFailFixture, refundFailRows } from './support/refund-fail-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:5 AC:B6:7 provider refund deadline and definitive refusal', () => {
    it.skipIf(skip)(
        'rejects at 180 days before persistence or provider calls, and accepts one millisecond earlier',
        async () => {
            // Arrange
            const expired = await refundFailFixture();
            const before = await refundFailRows({
                refundId: expired.refundId,
                paymentId: expired.payment.id,
                recipientId: expired.actor.id
            });
            expired.fixture.clock.advance({ ms: 180 * 86400000 });
            let reads = 0;
            let calls = 0;
            const provider = new Proxy(expired.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readCharge')
                        return async () => {
                            reads++;
                            return target.readCharge({
                                chargeId: expired.charge.chargeId
                            });
                        };
                    if (property === 'refund')
                        return async () => {
                            calls++;
                            throw new Error('unexpected refund');
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act / Assert
            await expect(
                confirmRefund(
                    { actor: expired.actor, refundId: expired.refundId },
                    { clock: expired.fixture.clock, provider }
                )
            ).rejects.toMatchObject({
                reason: 'REFUND_PAST_PROVIDER_WINDOW'
            });
            const after = await refundFailRows({
                refundId: expired.refundId,
                paymentId: expired.payment.id,
                recipientId: expired.actor.id
            });
            expect(after.refund?.status).toBe('REQUESTED');
            expect(after.refund?.version).toBe(before.refund?.version);
            expect(after.calls).toHaveLength(0);
            expect(after.keys).toHaveLength(0);
            expect(reads).toBe(0);
            expect(calls).toBe(0);
            const open = await refundFailFixture();
            open.fixture.clock.advance({ ms: 180 * 86400000 - 1 });
            const accepted = await confirmRefund(
                { actor: open.actor, refundId: open.refundId },
                { clock: open.fixture.clock, provider: open.fixture.provider }
            );
            expect(accepted.status).toBe('CONFIRMED');
        }
    );

    it.skipIf(skip)(
        'fails an answered non-2084 refusal and records its key without moving payment',
        async () => {
            // Arrange
            const seeded = await refundFailFixture();
            const before = await refundFailRows({
                refundId: seeded.refundId,
                paymentId: seeded.payment.id,
                recipientId: seeded.actor.id
            });
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async () => {
                            throw new PaymentProviderError({
                                code: 'REJECTED',
                                capability: 'refund',
                                message: 'refund rejected'
                            });
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );

            // Assert
            const after = await refundFailRows({
                refundId: seeded.refundId,
                paymentId: seeded.payment.id,
                recipientId: seeded.actor.id
            });
            expect(result).toMatchObject({ status: 'FAILED', outcome: 'PROVIDER_REJECTED_FAILED' });
            expect(after.refund?.status).toBe('FAILED');
            expect(after.calls).toHaveLength(1);
            expect(after.keys).toHaveLength(1);
            expect(after.keys[0]?.result).toEqual({ outcome: 'REJECTED', code: 'REJECTED' });
            expect(after.payment).toEqual(before.payment);
            expect(after.notices).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'keeps a partially accepted refund confirmed after a later non-2084 refusal',
        async () => {
            // Arrange
            const seeded = await refundFailFixture(10000, 5000);
            let calls = 0;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async (input: Parameters<typeof target.refund>[0]) => {
                            calls++;
                            if (calls === 1)
                                throw new PaymentProviderError({
                                    code: 'REJECTED',
                                    capability: 'refund',
                                    message: 'amount not accepted',
                                    refundRefusal: 'AMOUNT_NOT_ACCEPTED'
                                });
                            if (calls === 3)
                                throw new PaymentProviderError({
                                    code: 'REJECTED',
                                    capability: 'refund',
                                    message: 'refund rejected'
                                });
                            return { refundId: `accepted-${input.reference}` };
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act
            const result = await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider }
            );

            // Assert
            const after = await refundFailRows({
                refundId: seeded.refundId,
                paymentId: seeded.payment.id,
                recipientId: seeded.actor.id
            });
            expect(result).toMatchObject({
                status: 'CONFIRMED',
                outcome: 'PROVIDER_REJECTED_KEPT_CONFIRMED'
            });
            expect(after.refund?.status).toBe('CONFIRMED');
            expect(after.calls.filter((call) => call.providerRefundId !== null)).toHaveLength(1);
        }
    );
});
