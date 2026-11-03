import { eq, payments, refunds } from '@repo/db';
import { confirmRefund } from '../../../../src/services/billing/refund/confirm-refund.service.js';
import { getServiceTestDb } from '../helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './refund-confirm-fixtures.js';

/** Seeds a credited fake charge, requests RF1, and sends RF2 provider calls. */
export async function confirmedExecuteFixture(chargeAmount = 10000, refundAmount = 5000) {
    const seeded = await refundConfirmFixture(chargeAmount, refundAmount);
    const confirmation = await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
    );
    return { ...seeded, confirmation };
}

/** Reads only the rows seeded by the named fixture. */
export async function executeRows(refundId: string, paymentId: string) {
    const db = getServiceTestDb();
    const { refund, calls, keys } = await refundConfirmRows(refundId);
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    return { refund, calls, keys, payment };
}

/** Reads a single refund row by id for repeated execution assertions. */
export async function executeRefundRow(refundId: string) {
    const [refund] = await getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));
    return refund;
}
