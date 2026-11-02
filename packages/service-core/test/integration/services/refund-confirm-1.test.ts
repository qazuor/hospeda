import { eq, idempotencyKeys, manualPayments, refunds } from '@repo/db';
import type { RefundInput } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:1 AC:B6:1 RF2 confirmation persists a key before calling the provider', () => {
    it.skipIf(skip)(
        'confirms the row and records the provider response under its persisted key',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture();
            let observedPersistedKey: string | null = null;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async (input: RefundInput) => {
                            const [key] = await getServiceTestDb()
                                .select()
                                .from(idempotencyKeys)
                                .where(eq(idempotencyKeys.key, input.reference));
                            observedPersistedKey = key?.key ?? null;
                            return target.refund(input);
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
            const rows = await refundConfirmRows(seeded.refundId);
            expect(rows.refund).toMatchObject({
                status: 'CONFIRMED',
                confirmedBy: seeded.actor.id
            });
            expect(observedPersistedKey).toBe(rows.calls[0]?.idempotencyKey);
            expect(result).toMatchObject({
                refundId: seeded.refundId,
                status: 'CONFIRMED',
                outcome: 'SENT'
            });
            expect(rows.calls).toHaveLength(1);
            expect(rows.calls[0]).toMatchObject({
                amount: 10000,
                providerRefundId: result.calls[0]?.providerRefundId
            });
            expect(rows.keys).toMatchObject([
                {
                    key: rows.calls[0]?.idempotencyKey,
                    operation: 'REFUND_CREATE',
                    subjectId: seeded.refundId,
                    result: { outcome: 'ACCEPTED' }
                }
            ]);
        }
    );

    it.skipIf(skip)(
        'rejects an actor without ACC_13 and a system actor before provider calls',
        async () => {
            // Arrange
            const denied = await refundConfirmFixture();
            const deniedActor = {
                ...denied.actor,
                permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
            };
            const system = await refundConfirmFixture();
            const systemActor = { ...system.actor, roles: [RoleEnum.SYSTEM], _isSystemActor: true };
            let calls = 0;
            const counting = new Proxy(denied.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async (input: RefundInput) => {
                            calls++;
                            return target.refund(input);
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act / Assert
            await expect(
                confirmRefund(
                    { actor: deniedActor, refundId: denied.refundId },
                    { clock: denied.fixture.clock, provider: counting }
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expect(
                confirmRefund(
                    { actor: systemActor, refundId: system.refundId },
                    { clock: system.fixture.clock, provider: system.fixture.provider }
                )
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            expect(calls).toBe(0);
        }
    );

    it.skipIf(skip)(
        'keeps a confirmed row awaiting the provider when the fresh read is unavailable',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture();
            let callCount = 0;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readCharge')
                        return async () => {
                            throw new PaymentProviderError({
                                code: 'UNAVAILABLE',
                                capability: 'read',
                                message: 'provider unavailable'
                            });
                        };
                    if (property === 'refund')
                        return async (input: RefundInput) => {
                            callCount++;
                            return target.refund(input);
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
            const rows = await refundConfirmRows(seeded.refundId);
            expect(result).toMatchObject({
                status: 'CONFIRMED',
                outcome: 'AWAITING_PROVIDER_ANSWER',
                calls: []
            });
            expect(rows.refund?.status).toBe('CONFIRMED');
            expect(rows.calls).toHaveLength(0);
            expect(rows.keys).toHaveLength(0);
            expect(callCount).toBe(0);
        }
    );

    it.skipIf(skip)(
        'rejects a previously confirmed refund and a manual-payment source',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture();
            await getServiceTestDb()
                .update(refunds)
                .set({ status: 'CONFIRMED', confirmedBy: seeded.actor.id, version: 2 })
                .where(eq(refunds.id, seeded.refundId));
            const [manual] = await getServiceTestDb()
                .insert(manualPayments)
                .values({
                    subscriptionId: seeded.fixture.started.subscriptionId,
                    periodStart: new Date('2027-03-01T03:00:00.000Z'),
                    status: 'REGISTERED',
                    registeredBy: seeded.actor.id,
                    registeredAt: seeded.fixture.clock.now()
                })
                .returning();
            if (!manual) throw new Error('manual payment fixture missing');
            const manualRefund = await requestRefund(
                {
                    source: { kind: 'MANUAL_PAYMENT', id: manual.id },
                    amount: 100,
                    reason: 'REVOCATION'
                },
                { clock: seeded.fixture.clock }
            );
            let callCount = 0;
            const provider = new Proxy(seeded.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'refund')
                        return async (input: RefundInput) => {
                            callCount++;
                            return target.refund(input);
                        };
                    return Reflect.get(target, property, receiver);
                }
            });

            // Act / Assert
            await expect(
                confirmRefund(
                    { actor: seeded.actor, refundId: seeded.refundId },
                    { clock: seeded.fixture.clock, provider }
                )
            ).rejects.toMatchObject({ reason: 'REFUND_NOT_OPEN' });
            await expect(
                confirmRefund(
                    { actor: seeded.actor, refundId: manualRefund.refundId },
                    { clock: seeded.fixture.clock, provider }
                )
            ).rejects.toMatchObject({ reason: 'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE' });
            expect(callCount).toBe(0);
        }
    );
});
