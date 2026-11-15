import { and, emailOutbox, eq, refunds, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { declineRefund } from '../../../src/services/billing/refund/decline-refund.service.js';
import { failRefund } from '../../../src/services/billing/refund/refund-fail.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundFailFixture, refundFailRows } from './support/refund-fail-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:2 AC:B6:6 declining an open refund applies RF5', () => {
    it.skipIf(skip)(
        'fails a requested revocation without moving the payment and enqueues its notice',
        async () => {
            // Arrange
            const seeded = await refundFailFixture();
            const before = await refundFailRows({
                refundId: seeded.refundId,
                paymentId: seeded.payment.id,
                recipientId: seeded.actor.id
            });

            // Act
            const result = await declineRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock }
            );

            // Assert
            const after = await refundFailRows({
                refundId: seeded.refundId,
                paymentId: seeded.payment.id,
                recipientId: seeded.actor.id
            });
            expect(result).toMatchObject({ refundId: seeded.refundId, status: 'FAILED' });
            expect(after.refund?.status).toBe('FAILED');
            expect(after.calls).toHaveLength(0);
            expect(after.keys).toHaveLength(0);
            expect(after.payment).toEqual(before.payment);
            expect(after.notices).toHaveLength(1);
            expect(after.notices[0]?.payload.refundId).toBe(seeded.refundId);
        }
    );

    it.skipIf(skip)('does not enqueue a notice for a non-revocation reason', async () => {
        // Arrange
        const seeded = await refundFailFixture();
        await getServiceTestDb()
            .update(refunds)
            .set({ reason: 'MARK_PROPOSAL' })
            .where(eq(refunds.id, seeded.refundId));

        // Act
        await declineRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock }
        );

        // Assert
        const after = await refundFailRows({
            refundId: seeded.refundId,
            paymentId: seeded.payment.id,
            recipientId: seeded.actor.id
        });
        expect(after.refund?.status).toBe('FAILED');
        expect(after.notices).toHaveLength(0);
    });

    it.skipIf(skip)(
        'rejects an accepted confirmed refund but fails a confirmed row with only answered 2084 calls',
        async () => {
            // Arrange
            const accepted = await refundFailFixture();
            await confirmRefund(
                { actor: accepted.actor, refundId: accepted.refundId },
                { clock: accepted.fixture.clock, provider: accepted.fixture.provider }
            );
            const refused = await refundFailFixture(10000, 5000);
            const { PaymentProviderError } = await import('@repo/payments');
            const provider = new Proxy(refused.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async () => {
                            throw new PaymentProviderError({
                                code: 'REJECTED',
                                capability: 'refund',
                                message: 'amount not accepted',
                                refundRefusal: 'AMOUNT_NOT_ACCEPTED'
                            });
                        };
                    return Reflect.get(target, property, receiver);
                }
            });
            await confirmRefund(
                { actor: refused.actor, refundId: refused.refundId },
                { clock: refused.fixture.clock, provider }
            );

            // Act / Assert
            await expect(
                declineRefund(
                    { actor: accepted.actor, refundId: accepted.refundId },
                    { clock: accepted.fixture.clock }
                )
            ).rejects.toMatchObject({ reason: 'REFUND_HAS_PROVIDER_CALLS' });
            expect(
                (
                    await refundFailRows({
                        refundId: accepted.refundId,
                        paymentId: accepted.payment.id,
                        recipientId: accepted.actor.id
                    })
                ).refund?.status
            ).toBe('CONFIRMED');
            const result = await declineRefund(
                { actor: refused.actor, refundId: refused.refundId },
                { clock: refused.fixture.clock }
            );
            expect(result.status).toBe('FAILED');
        }
    );

    it.skipIf(skip)('rejects a confirmed refund with an unanswered provider call', async () => {
        // Arrange
        const seeded = await refundFailFixture();
        const { PaymentProviderError } = await import('@repo/payments');
        const provider = new Proxy(seeded.fixture.provider, {
            get(target, property, receiver) {
                if (property === 'refund')
                    return async () => {
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'provider unavailable'
                        });
                    };
                return Reflect.get(target, property, receiver);
            }
        });
        await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider }
        );
        const before = await refundFailRows({
            refundId: seeded.refundId,
            paymentId: seeded.payment.id,
            recipientId: seeded.actor.id
        });
        expect(before.calls).toHaveLength(1);
        expect(before.calls[0]?.providerRefundId).toBeNull();
        expect(before.keys).toHaveLength(1);
        expect(before.keys[0]?.result).toBeNull();

        // Act
        await expect(
            declineRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock }
            )
        ).rejects.toMatchObject({ reason: 'REFUND_HAS_PROVIDER_CALLS' });

        // Assert
        const after = await refundFailRows({
            refundId: seeded.refundId,
            paymentId: seeded.payment.id,
            recipientId: seeded.actor.id
        });
        expect(after.refund?.status).toBe('CONFIRMED');
        expect(after.notices).toHaveLength(0);
        expect(after.payment).toEqual(before.payment);
    });

    it.skipIf(skip)(
        'rejects actors without permission, system actors, and terminal rows',
        async () => {
            // Arrange
            const denied = await refundFailFixture();
            const system = await refundFailFixture();
            const terminal = await refundFailFixture();
            await getServiceTestDb()
                .update(refunds)
                .set({ status: 'FAILED' })
                .where(eq(refunds.id, terminal.refundId));

            // Act / Assert
            await expect(
                declineRefund(
                    {
                        actor: {
                            ...denied.actor,
                            permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
                        },
                        refundId: denied.refundId
                    },
                    { clock: denied.fixture.clock }
                )
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            await expect(
                declineRefund(
                    {
                        actor: { ...system.actor, roles: [RoleEnum.SYSTEM], _isSystemActor: true },
                        refundId: system.refundId
                    },
                    { clock: system.fixture.clock }
                )
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            await expect(
                declineRefund(
                    { actor: terminal.actor, refundId: terminal.refundId },
                    { clock: terminal.fixture.clock }
                )
            ).rejects.toMatchObject({ reason: 'REFUND_NOT_OPEN' });
        }
    );

    it.skipIf(skip)(
        'settles a later transfer in a new row while the failed row stays terminal',
        async () => {
            // Arrange
            const seeded = await refundFailFixture();
            await declineRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock }
            );

            // Act
            const settled = await settleExternalRefund(
                {
                    actor: {
                        ...seeded.actor,
                        permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
                    },
                    source: { kind: 'PAYMENT', id: seeded.payment.id },
                    amount: 10000,
                    channel: 'BANK_TRANSFER',
                    reference: `rf5-${crypto.randomUUID()}`,
                    reason: 'OUT_OF_FLOW_REFUND'
                },
                { clock: seeded.fixture.clock }
            );

            // Assert
            expect(new Set([settled.refundId, seeded.refundId]).size).toBe(2);
            const [newRow] = await getServiceTestDb()
                .select()
                .from(refunds)
                .where(eq(refunds.id, settled.refundId));
            expect(newRow?.status).toBe('EXECUTED');
            expect(
                (
                    await refundFailRows({
                        refundId: seeded.refundId,
                        paymentId: seeded.payment.id,
                        recipientId: seeded.actor.id
                    })
                ).refund?.status
            ).toBe('FAILED');
        }
    );

    it.skipIf(skip)(
        'rolls back the revocation notice when RF5 transaction rolls back',
        async () => {
            // Arrange
            const seeded = await refundFailFixture();

            // Act
            await expect(
                getServiceTestDb().transaction(async (tx) => {
                    const [refund] = await tx
                        .select()
                        .from(refunds)
                        .where(eq(refunds.id, seeded.refundId))
                        .for('update');
                    if (!refund) throw new Error('seeded refund missing');
                    await failRefund({
                        tx,
                        refund,
                        at: seeded.fixture.clock.now(),
                        correlationId: crypto.randomUUID()
                    });
                    const inside = await tx
                        .select({ id: emailOutbox.id })
                        .from(emailOutbox)
                        .where(
                            and(
                                sql`${emailOutbox.payload}->>'refundId' = ${seeded.refundId}`,
                                eq(emailOutbox.recipientUserId, seeded.actor.id)
                            )
                        );
                    expect(inside).toHaveLength(1);
                    throw new Error('rollback marker');
                })
            ).rejects.toThrow('rollback marker');

            // Assert
            const after = await refundFailRows({
                refundId: seeded.refundId,
                paymentId: seeded.payment.id,
                recipientId: seeded.actor.id
            });
            expect(after.refund?.status).toBe('REQUESTED');
            expect(after.notices).toHaveLength(0);
        }
    );

    it.skipIf(skip)('enqueues a revocation notice for the chargeback RF5 path', async () => {
        // Arrange
        const seeded = await refundFailFixture();
        await seeded.fixture.provider.chargeBack({ chargeId: seeded.charge.chargeId });

        // Act
        const result = await confirmRefund(
            { actor: seeded.actor, refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );

        // Assert
        const after = await refundFailRows({
            refundId: seeded.refundId,
            paymentId: seeded.payment.id,
            recipientId: seeded.actor.id
        });
        expect(result).toMatchObject({ status: 'FAILED', outcome: 'CHARGED_BACK' });
        expect(after.refund?.status).toBe('FAILED');
        expect(after.notices).toHaveLength(1);
    });
});
