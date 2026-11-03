import { and, emailOutbox, eq, payments, sql, userRole } from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './refund-confirm-fixtures.js';

/** Creates a refund and a recipient owned by the test. */
export async function refundFailFixture(amount = 10000, refundAmount = amount) {
    const seeded = await refundConfirmFixture(amount, refundAmount);
    await getServiceTestDb()
        .insert(userRole)
        .values({ userId: seeded.actor.id, role: 'SUPER_ADMIN' });
    return seeded;
}

/** Reads only payment and outbox rows owned by the seeded refund. */
export async function refundFailRows(input: {
    readonly refundId: string;
    readonly paymentId: string;
    readonly recipientId: string;
}) {
    const db = getServiceTestDb();
    const rows = await refundConfirmRows(input.refundId);
    const [payment] = await db
        .select({
            status: payments.status,
            refundedAmount: payments.refundedAmount,
            version: payments.version
        })
        .from(payments)
        .where(eq(payments.id, input.paymentId));
    const notices = await db
        .select()
        .from(emailOutbox)
        .where(
            and(
                sql`${emailOutbox.payload}->>'refundId' = ${input.refundId}`,
                eq(emailOutbox.recipientUserId, input.recipientId)
            )
        );
    return { ...rows, payment, notices };
}
