import { eq, idempotencyKeys, refundCalls, refunds } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { requestRefund } from '../../../../src/services/billing/refund/request-refund.service.js';
import {
    type SettleRefundRemainderInput,
    settleRefundRemainder
} from '../../../../src/services/billing/refund/settle-refund-remainder.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';
import { type CreditedPayment, creditedPayment, seedAdminActor } from './refund-fixtures.js';

/** One provider call to persist on a refund: accepted (with an id), rejected or unanswered. */
export type SeededCall =
    | { readonly kind: 'ACCEPTED'; readonly amount: number; readonly providerRefundId?: string }
    | { readonly kind: 'REJECTED'; readonly amount: number }
    | { readonly kind: 'UNANSWERED'; readonly amount: number };

/**
 * Persists calls on a refund the way `persistCall` + `completeCall` leave them, and moves the
 * refund to `CONFIRMED` (by `confirmedBy`) when it is not yet.
 */
export async function seedProviderCalls(input: {
    readonly refundId: string;
    readonly confirmedBy: string;
    readonly calls: readonly SeededCall[];
    readonly at: Date;
}) {
    const db = getServiceTestDb();
    await db
        .update(refunds)
        .set({ status: 'CONFIRMED', confirmedBy: input.confirmedBy })
        .where(eq(refunds.id, input.refundId));
    const ids: string[] = [];
    for (const [index, call] of input.calls.entries()) {
        const key = `refund:${input.refundId}:${index + 1}`;
        const providerRefundId =
            call.kind === 'ACCEPTED'
                ? (call.providerRefundId ?? `mp-accepted-${crypto.randomUUID()}`)
                : null;
        const result =
            call.kind === 'ACCEPTED'
                ? { outcome: 'ACCEPTED', providerRefundId }
                : call.kind === 'REJECTED'
                  ? { outcome: 'REJECTED', refusal: 'AMOUNT_NOT_ACCEPTED' }
                  : null;
        await db.insert(idempotencyKeys).values({
            key,
            operation: 'REFUND_CREATE',
            subjectId: input.refundId,
            result,
            completedAt: result === null ? null : input.at
        });
        await db.insert(refundCalls).values({
            refundId: input.refundId,
            idempotencyKey: key,
            amount: call.amount,
            providerRefundId
        });
        if (providerRefundId) ids.push(providerRefundId);
    }
    return { acceptedIds: ids };
}

/**
 * A credited 10000 payment with a 6000 `CONFIRMED` refund whose provider calls are `calls`
 * (by default one accepted 4000 and one rejected 2000: the provider accepted only part).
 */
export async function partiallyAcceptedRefund(
    calls: readonly SeededCall[] = [
        { kind: 'ACCEPTED', amount: 4000 },
        { kind: 'REJECTED', amount: 2000 }
    ]
) {
    const credited = await creditedPayment(10000);
    const confirmer = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
    const { refundId } = await requestRefund(
        {
            source: { kind: 'PAYMENT', id: credited.payment.id },
            amount: 6000,
            reason: 'REVOCATION'
        },
        { clock: credited.fixture.clock }
    );
    const seeded = await seedProviderCalls({
        refundId,
        confirmedBy: confirmer.id,
        calls,
        at: credited.fixture.clock.now()
    });
    const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
    return { credited, confirmer, settler, refundId, ...seeded };
}

/** The remainder settlement on a refund: 2000 with a fresh panel reference unless overridden. */
export function settleRemainder(
    actor: Actor,
    arranged: { readonly refundId: string; readonly credited: CreditedPayment },
    overrides: Partial<SettleRefundRemainderInput> = {}
) {
    return settleRefundRemainder(
        {
            actor,
            refundId: arranged.refundId,
            amount: 2000,
            reference: `mp-panel-${crypto.randomUUID()}`,
            ...overrides
        },
        { clock: arranged.credited.fixture.clock }
    );
}
