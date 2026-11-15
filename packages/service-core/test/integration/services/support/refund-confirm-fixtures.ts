import { eq, idempotencyKeys, payments, refundCalls, refunds, users } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { creditPayment } from '../../../../src/services/billing/payment/credit-payment.service.js';
import { requestRefund } from '../../../../src/services/billing/refund/request-refund.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';
import { paymentFixture } from './payment-fixtures.js';

/** Creates a real credited row whose provider fact exists in the fake ledger. */
export async function refundConfirmFixture(amount = 10000, refundAmount = amount) {
    const fixture = await paymentFixture();
    const charge = await fixture.provider.charge({
        authorizationId: fixture.started.authorizationId,
        amount: { amountMinor: amount, currency: 'ARS' },
        reference: fixture.started.subscriptionId
    });
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: charge.chargeId,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!payment) throw new Error('refund confirmation payment missing');
    await creditPayment(
        { paymentId: payment.id, chargeCreatedAt: fixture.clock.now() },
        { clock: fixture.clock }
    );
    const [actorRow] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `refund-confirm-${crypto.randomUUID()}@example.test`,
            displayName: 'Refund confirmation admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!actorRow) throw new Error('refund confirmation actor missing');
    const actor: Actor = {
        id: actorRow.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REFUND]
    };
    const request = await requestRefund(
        { source: { kind: 'PAYMENT', id: payment.id }, amount: refundAmount, reason: 'REVOCATION' },
        { clock: fixture.clock }
    );
    return { fixture, payment, charge, actor, refundId: request.refundId };
}

/** Reads rows belonging to one refund, independent of unrelated database fixtures. */
export async function refundConfirmRows(refundId: string) {
    const db = getServiceTestDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
    const calls = await db.select().from(refundCalls).where(eq(refundCalls.refundId, refundId));
    const keys = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, refundId));
    return { refund, calls, keys };
}
