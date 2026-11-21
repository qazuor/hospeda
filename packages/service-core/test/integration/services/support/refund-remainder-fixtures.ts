import { eq, idempotencyKeys, payments, refundCalls, refunds } from '@repo/db';
import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { PermissionEnum } from '@repo/schemas';
import { creditPayment } from '../../../../src/services/billing/payment/credit-payment.service.js';
import { requestRefund } from '../../../../src/services/billing/refund/request-refund.service.js';
import {
    type SettleRefundRemainderInput,
    settleRefundRemainder
} from '../../../../src/services/billing/refund/settle-refund-remainder.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';
import { paymentFixture } from './payment-fixtures.js';
import { seedAdminActor } from './refund-fixtures.js';

/**
 * One provider call to persist on a refund: accepted (with an id), rejected or unanswered. An
 * accepted call without `providerRefundId` is refunded for real at the fake, for `providerAmount`
 * (what the provider returns) or else its own `amount` (what we asked).
 */
export type SeededCall =
    | {
          readonly kind: 'ACCEPTED';
          readonly amount: number;
          readonly providerRefundId?: string;
          readonly providerAmount?: number;
      }
    | { readonly kind: 'REJECTED'; readonly amount: number }
    | { readonly kind: 'UNANSWERED'; readonly amount: number }
    /** Completed without a provider refund id and not as a rejection (the provider was unavailable). */
    | { readonly kind: 'UNAVAILABLE'; readonly amount: number };

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
                  : call.kind === 'UNAVAILABLE'
                    ? { outcome: 'UNAVAILABLE' }
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
 * Refunds `amount` of a charge at the fake and returns the provider refund id. The first partial
 * refund of a charge is refused as not refundable (lie M13, on), so it is asked once more.
 */
export async function refundAtFake(input: {
    readonly provider: PaymentProvider;
    readonly chargeId: string;
    readonly amount: number;
}): Promise<string> {
    for (let attempt = 0; ; attempt++) {
        try {
            const { refundId } = await input.provider.refund({
                chargeId: input.chargeId,
                amount: { amountMinor: input.amount, currency: 'ARS' },
                reference: `refund-${crypto.randomUUID()}`
            });
            return refundId;
        } catch (error) {
            const m13 =
                error instanceof PaymentProviderError &&
                error.refundRefusal === 'AMOUNT_NOT_ACCEPTED';
            if (!m13 || attempt > 0) throw error;
        }
    }
}

/** A payment credited through P1 whose provider fact is a real approved charge in the fake. */
export async function chargedCreditedPayment(amount = 10000) {
    const fixture = await paymentFixture();
    const charge = await fixture.provider.charge({
        authorizationId: fixture.started.authorizationId,
        amount: { amountMinor: amount, currency: 'ARS' },
        reference: fixture.started.subscriptionId
    });
    const [pending] = await getServiceTestDb()
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
    if (!pending) throw new Error('remainder fixture payment missing');
    await creditPayment(
        { paymentId: pending.id, chargeCreatedAt: fixture.clock.now() },
        { clock: fixture.clock }
    );
    return { fixture, payment: pending };
}

/** A charged credited payment as returned by `chargedCreditedPayment`. */
export type ChargedPayment = Awaited<ReturnType<typeof chargedCreditedPayment>>;

/** Gives every accepted call without an id a real refund at the fake. */
export async function refundAcceptedAtFake(input: {
    readonly provider: PaymentProvider;
    readonly chargeId: string;
    readonly calls: readonly SeededCall[];
}): Promise<readonly SeededCall[]> {
    const resolved: SeededCall[] = [];
    for (const call of input.calls) {
        if (call.kind !== 'ACCEPTED' || call.providerRefundId) {
            resolved.push(call);
            continue;
        }
        const providerRefundId = await refundAtFake({
            provider: input.provider,
            chargeId: input.chargeId,
            amount: call.providerAmount ?? call.amount
        });
        resolved.push({ ...call, providerRefundId });
    }
    return resolved;
}

/**
 * A credited 10000 payment on a real fake charge with a 6000 `CONFIRMED` refund whose provider
 * calls are `calls` (by default one accepted 4000, credited at the fake, and one rejected 2000:
 * the provider accepted only part).
 */
export async function partiallyAcceptedRefund(
    calls: readonly SeededCall[] = [
        { kind: 'ACCEPTED', amount: 4000 },
        { kind: 'REJECTED', amount: 2000 }
    ]
) {
    const credited = await chargedCreditedPayment(10000);
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
        calls: await refundAcceptedAtFake({
            provider: credited.fixture.provider,
            chargeId: credited.payment.providerFactId,
            calls
        }),
        at: credited.fixture.clock.now()
    });
    const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
    return { credited, confirmer, settler, refundId, ...seeded };
}

/** The remainder refunded by hand from the provider panel: a real refund at the fake. */
export function panelRefund(arranged: { readonly credited: ChargedPayment }, amount = 2000) {
    return refundAtFake({
        provider: arranged.credited.fixture.provider,
        chargeId: arranged.credited.payment.providerFactId,
        amount
    });
}

/**
 * The remainder settlement on a refund: 2000, with the id of a fresh 2000 panel refund at the fake
 * as its reference unless overridden.
 */
export async function settleRemainder(
    actor: Actor,
    arranged: { readonly refundId: string; readonly credited: ChargedPayment },
    overrides: Partial<SettleRefundRemainderInput> = {}
) {
    const reference = overrides.reference ?? (await panelRefund(arranged));
    return settleRefundRemainder(
        { actor, refundId: arranged.refundId, amount: 2000, ...overrides, reference },
        { provider: arranged.credited.fixture.provider, clock: arranged.credited.fixture.clock }
    );
}
