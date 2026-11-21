import { eq, idempotencyKeys, refundCalls } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { expect } from 'vitest';
import { REFUND_CALL_RETRY_LIMIT_MS } from '../../../../src/services/billing/refund/refund-call-tally.js';
import { requestRefund } from '../../../../src/services/billing/refund/request-refund.service.js';
import { settleRefundRemainder } from '../../../../src/services/billing/refund/settle-refund-remainder.service.js';
import { getServiceTestDb } from '../helpers.js';
import { paymentRow, refundById, seedAdminActor } from './refund-fixtures.js';
import {
    chargedCreditedPayment,
    refundAcceptedAtFake,
    refundAtFake,
    type SeededCall,
    seedProviderCalls
} from './refund-remainder-fixtures.js';

/**
 * A credited 10000 payment on a real fake charge with a `CONFIRMED` refund of `amount` whose calls
 * are `calls`; every unanswered call was sent `ageMs` before the clock's now.
 */
export async function stuckRefund(input: {
    readonly amount?: number;
    readonly calls?: readonly SeededCall[];
    readonly ageMs: number;
}) {
    const amount = input.amount ?? 6000;
    const credited = await chargedCreditedPayment(10000);
    const confirmer = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
    const { refundId } = await requestRefund(
        { source: { kind: 'PAYMENT', id: credited.payment.id }, amount, reason: 'REVOCATION' },
        { clock: credited.fixture.clock }
    );
    await seedProviderCalls({
        refundId,
        confirmedBy: confirmer.id,
        calls: await refundAcceptedAtFake({
            provider: credited.fixture.provider,
            chargeId: credited.payment.providerFactId,
            calls: input.calls ?? [{ kind: 'UNANSWERED', amount }]
        }),
        at: credited.fixture.clock.now()
    });
    // The calls were persisted `ageMs` ago, on the injected clock (`persistCall` writes `sentAt`).
    await getServiceTestDb()
        .update(refundCalls)
        .set({ createdAt: new Date(credited.fixture.clock.now().getTime() - input.ageMs) })
        .where(eq(refundCalls.refundId, refundId));
    const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
    return { credited, confirmer, settler, refundId, amount };
}

export type Stuck = Awaited<ReturnType<typeof stuckRefund>>;

/** A refund made by hand from the provider panel: a real refund at the fake. */
export function panelRefund(stuck: Stuck, amount = stuck.amount) {
    return refundAtFake({
        provider: stuck.credited.fixture.provider,
        chargeId: stuck.credited.payment.providerFactId,
        amount
    });
}

export function settle(stuck: Stuck, reference: string, amount = stuck.amount) {
    return settleRefundRemainder(
        { actor: stuck.settler, refundId: stuck.refundId, amount, reference },
        { provider: stuck.credited.fixture.provider, clock: stuck.credited.fixture.clock }
    );
}

export async function callRows(refundId: string) {
    const db = getServiceTestDb();
    return db
        .select({
            key: refundCalls.idempotencyKey,
            providerRefundId: refundCalls.providerRefundId,
            completedAt: idempotencyKeys.completedAt,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(eq(refundCalls.refundId, refundId));
}

export async function expectUntouched(stuck: Stuck) {
    expect(await refundById(stuck.refundId)).toMatchObject({
        status: 'CONFIRMED',
        externalRef: null,
        settledBy: null
    });
    expect((await paymentRow(stuck.credited.payment.id))?.refundedAmount).toBe(0);
    for (const call of await callRows(stuck.refundId)) {
        expect(call.providerRefundId).toBeNull();
        if (call.completedAt === null) expect(call.result).toBeNull();
    }
}

export const PAST_LIMIT = REFUND_CALL_RETRY_LIMIT_MS + 1;
