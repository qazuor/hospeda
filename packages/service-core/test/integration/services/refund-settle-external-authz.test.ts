import { payments, providerLinks, subscriptions } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    type CreditedPayment,
    creditedPayment,
    paymentRow,
    refundById,
    refundsOfPayment,
    seedAdminActor
} from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

function settleTotal(actor: Actor, credited: CreditedPayment) {
    return settleExternalRefund(
        {
            actor,
            source: { kind: 'PAYMENT', id: credited.payment.id },
            amount: 10000,
            channel: 'PROVIDER_PANEL',
            reference: `panel-${crypto.randomUUID()}`,
            reason: 'OUT_OF_FLOW_REFUND'
        },
        { clock: credited.fixture.clock }
    );
}

async function expectForbiddenAndUntouched(actor: Actor, credited: CreditedPayment) {
    const paymentBefore = await paymentRow(credited.payment.id);
    const refundsBefore = await refundsOfPayment(credited.payment.id);
    await expect(settleTotal(actor, credited)).rejects.toMatchObject({
        code: 'FORBIDDEN',
        reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
    });
    expect(await refundsOfPayment(credited.payment.id)).toEqual(refundsBefore);
    expect(await paymentRow(credited.payment.id)).toEqual(paymentBefore);
}

describe('TEST:B5:6 AC:B5:10 admin action 14 authorizes inside the transaction', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (m) an actor with the legacy refund and neighbour permissions but not ACC_14 is FORBIDDEN',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const actor = await seedAdminActor([
                PermissionEnum.REFUND_PROCESS,
                PermissionEnum.PAYMENT_REFUND,
                PermissionEnum.REFUND_APPROVE,
                PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                PermissionEnum.PARTNER_MANAGE
            ]);

            // Act / Assert
            await expectForbiddenAndUntouched(actor, credited);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (n) the subject (owner of the subscription) is FORBIDDEN even with the permission',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const actor: Actor = {
                id: credited.fixture.user.id,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
            };

            // Act / Assert
            await expectForbiddenAndUntouched(actor, credited);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (o) a system actor is FORBIDDEN even when it carries the permission',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            // createSystemActor refuses to build a system actor with an
            // administrative permission (SystemActorDefinitionError), so a marked
            // actor that carries BILLING_SETTLE_EXTERNAL can only be hand-built
            // here: it proves step 3 rejects the marker, not just the permission.
            const actor: Actor = {
                id: admin.id,
                roles: [RoleEnum.SYSTEM],
                permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL],
                _isSystemActor: true
            };

            // Act / Assert
            await expectForbiddenAndUntouched(actor, credited);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (p) a payment of a LAPIDA subscription without user_id: the permitted actor settles (subject null)',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            // The tombstone's provider link is checked by a deferred trigger, so
            // both rows go in one transaction (molde of payment-receipt TEST:B5:1).
            const payment = await getServiceTestDb().transaction(async (tx) => {
                const [tombstone] = await tx
                    .insert(subscriptions)
                    .values({ status: 'CANCELLED', class: 'LAPIDA' })
                    .returning();
                await tx.insert(providerLinks).values({
                    subscriptionId: tombstone!.id,
                    provider: 'MERCADO_PAGO',
                    providerId: `b53-tombstone-${crypto.randomUUID()}`
                });
                const [row] = await tx
                    .insert(payments)
                    .values({
                        subscriptionId: tombstone!.id,
                        amount: 10000,
                        currency: 'ARS',
                        status: 'SUCCEEDED',
                        provider: 'MERCADO_PAGO',
                        providerFactId: `b53-tombstone-${crypto.randomUUID()}`,
                        factAt: credited.fixture.clock.now()
                    })
                    .returning();
                return row;
            });

            // Act
            const result = await settleTotal(admin, { ...credited, payment: payment! });

            // Assert
            expect(result).toMatchObject({ subjectId: null, paymentOutcome: 'P3' });
            expect(await refundById(result.refundId)).toMatchObject({
                status: 'EXECUTED',
                settledBy: admin.id
            });
        }
    );
});

describe('TEST:B5:6 AC:B5:41 two concurrent settlements of one REQUESTED', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (q) exactly one closes the row; the other gets a typed rejection; EXECUTED never exceeds the payment',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: credited.payment.id },
                    amount: 10000,
                    reason: 'REVOCATION'
                },
                { clock: credited.fixture.clock }
            );

            // Act
            const outcomes = await Promise.allSettled([
                settleTotal(admin, credited),
                settleTotal(admin, credited)
            ]);

            // Assert
            const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
            const rejected = outcomes.filter(
                (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
            );
            expect(fulfilled).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            // The loser waits on the payment lock and then reads it REFUNDED
            // (PAYMENT_NOT_REFUNDABLE) or its balance spent; either is typed.
            expect([
                'PAYMENT_NOT_REFUNDABLE',
                'REFUND_EXCEEDS_BALANCE',
                'REFUND_NOT_OPEN',
                'REFUND_STATE_CHANGED'
            ]).toContain((rejected[0]?.reason as { reason?: string }).reason);
            const rows = await refundsOfPayment(credited.payment.id);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ id: refundId, status: 'EXECUTED', version: 2 });
            const executed = rows
                .filter((row) => row.status === 'EXECUTED')
                .reduce((sum, row) => sum + row.amount, 0);
            expect(executed).toBeLessThanOrEqual(credited.payment.amount);
            expect(await paymentRow(credited.payment.id)).toMatchObject({
                status: 'REFUNDED',
                refundedAmount: 10000
            });
        }
    );
});
