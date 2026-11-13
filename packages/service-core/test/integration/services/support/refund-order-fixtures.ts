import { eq, idempotencyKeys, payments, refundCalls, refunds, users } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { requestRefund } from '../../../../src/services/billing/refund/request-refund.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';
import { seedOrderInstance } from './paid-order-fixtures.js';
import { paymentFixture } from './payment-fixtures.js';

/** Seeds a paid one-time order and a requested refund (AC:B6:8, TRANS:B:RF2). */
export async function refundOrderFixture(
    input: {
        readonly amount?: number;
        readonly refundAmount?: number;
        readonly paid?: boolean;
        readonly withOrder?: boolean;
    } = {}
) {
    const amount = input.amount ?? 10000;
    const fixture = await paymentFixture();
    const { orderId } = fixture.provider.placeOrder({
        reference: `refund-order-${crypto.randomUUID()}`,
        paid: input.paid ?? true,
        amount: { amountMinor: amount, currency: 'ARS' }
    });
    const instance = await seedOrderInstance({
        providerOrderId: input.withOrder === false ? null : orderId,
        status: 'ACTIVE',
        key: null
    });
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            addonInstanceId: instance.instanceId,
            amount,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: fixture.link.provider,
            providerFactId: `order-payment-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!payment) throw new Error('Order refund payment missing');
    const [actorRow] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `refund-order-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Order refund admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!actorRow) throw new Error('Order refund actor missing');
    const actor: Actor = {
        id: actorRow.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REFUND]
    };
    const request = await requestRefund(
        {
            source: { kind: 'PAYMENT', id: payment.id },
            amount: input.refundAmount ?? amount,
            reason: 'REVOCATION'
        },
        { clock: fixture.clock }
    );
    return { fixture, orderId, instance, payment, actor, refundId: request.refundId };
}

/** Reads only this refund's persisted RF2 rows (AC:B6:8, TRANS:B:RF2). */
export async function orderRefundRows(refundId: string) {
    const db = getServiceTestDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
    const calls = await db.select().from(refundCalls).where(eq(refundCalls.refundId, refundId));
    const keys = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, refundId));
    return { refund, calls, keys };
}
