import {
    eq,
    getDb,
    idempotencyKeys,
    inArray,
    payments,
    reconciliationMarkPayments,
    refundCalls,
    refunds
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { PermissionEnum } from '@repo/schemas';
import { requestRefund } from '@repo/service-core';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import {
    actorHeaders,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedCardRevocable,
    seedUser
} from '../billing-subscription/revocation-route-fixtures';

export const confirmClock = routeClock();
export const baselineFake = routeFake(confirmClock);
export const confirmFake = new FakePaymentProvider({
    clock: confirmClock,
    idNamespace: crypto.randomUUID(),
    honestAbout: [
        { lie: 'M1', why: 'route fixture needs signup creation to land' },
        { lie: 'M6', why: 'route fixture does not inspect notices' },
        { lie: 'M8', why: 'refund route fixture requires an approved charge' }
    ]
});
const seededRefundIds: string[] = [];
const seededPaymentIds: string[] = [];

/** Seeds a real fake-provider charge, credited payment, requested refund, and admin actor. */
export async function seedConfirmRefund(amount = 10000, refundAmount = amount) {
    const seeded = await seedCardRevocable({ fake: confirmFake, clock: confirmClock });
    seededPaymentIds.push(seeded.paymentId);
    const charge = await confirmFake.charge({
        authorizationId: seeded.authorizationId,
        amount: { amountMinor: amount, currency: 'ARS' },
        reference: `confirm-refund-${crypto.randomUUID()}`
    });
    await getDb()
        .update(payments)
        .set({ providerFactId: charge.chargeId })
        .where(eq(payments.id, seeded.paymentId));
    const requested = await requestRefund(
        {
            source: { kind: 'PAYMENT', id: seeded.paymentId },
            amount: refundAmount,
            reason: 'REVOCATION'
        },
        { clock: confirmClock }
    );
    seededRefundIds.push(requested.refundId);
    return {
        ...seeded,
        chargeId: charge.chargeId,
        refundId: requested.refundId,
        adminId: await seedUser('refund-admin')
    };
}

/** Installs the provider fake for route requests and returns a request function. */
export async function confirmRequest(
    app: { request: (input: string, init: RequestInit) => Response | Promise<Response> },
    refundId: string,
    actor?: { id: string; role: string; permissions: readonly PermissionEnum[] },
    body: unknown = { confirmed: true }
): Promise<Response> {
    injectPaymentProvider({ provider: confirmFake });
    return await app.request(`/api/v1/admin/billing-refunds/${refundId}/confirm`, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

/** Rows written for one refund, including its persisted idempotency keys. */
export async function confirmRows(refundId: string) {
    const db = getDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
    const calls = await db.select().from(refundCalls).where(eq(refundCalls.refundId, refundId));
    const keys = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, refundId));
    return { refund, calls, keys };
}

/** Deletes only the rows created by the shared revocation route fixture. */
export async function cleanupConfirmRefundRows() {
    if (seededRefundIds.length > 0) {
        await getDb().delete(refundCalls).where(inArray(refundCalls.refundId, seededRefundIds));
        await getDb()
            .delete(idempotencyKeys)
            .where(inArray(idempotencyKeys.subjectId, seededRefundIds));
        seededRefundIds.splice(0);
    }
    if (seededPaymentIds.length > 0) {
        await getDb()
            .delete(reconciliationMarkPayments)
            .where(inArray(reconciliationMarkPayments.paymentId, seededPaymentIds));
        seededPaymentIds.splice(0);
    }
    await retireRevocationRouteRows();
}
