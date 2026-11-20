import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, eq, getDb, payments, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import type { ApplyExecutedRefundResult } from '../payment/apply-executed-refund.service';
import {
    assertPanelReferenceUnused,
    authorizeRefundAction14,
    externalReferenceAlreadySettled,
    PANEL_REFERENCE_CONSTRAINT,
    readRefundSubject
} from './refund-action14';
import { hasOtherUnansweredRefundCall, readRefundCallTally } from './refund-call-tally';
import { closeExecutedPaymentRefund } from './refund-closure';
import { canRefundTransition, type RefundStatus } from './refund-machine';
import {
    assertRemainderAtProvider,
    type ChargeRefundsRead,
    creditedAcceptedAmount,
    readChargeRefunds
} from './refund-remainder-provider';
import { assertRefundAmount, lockRefundSource } from './refund-source';

/** Input of the remainder settlement (HOS-2406). */
export type SettleRefundRemainderInput = {
    readonly actor: Actor;
    /** The `CONFIRMED` refund the provider accepted only in part. */
    readonly refundId: string;
    /** The remainder refunded by hand from the provider panel, in cents; must equal what is owed. */
    readonly amount: number;
    /** The provider panel refund id of the remainder; non-empty, ≤ 255, already trimmed. */
    readonly reference: string;
};

/** Result of the remainder settlement. */
export type SettleRefundRemainderResult = {
    readonly refundId: string;
    readonly subjectId: string | null;
    /** Sum, in cents, the provider reports credited for the accepted calls (what it returned, not what we asked). */
    readonly acceptedAmount: number;
    /** The remainder recorded from the provider panel, in cents. */
    readonly remainderAmount: number;
    readonly paymentOutcome: ApplyExecutedRefundResult['outcome'];
    readonly coverageReleased: boolean;
};

/** Every `reason` a rejection of `settleRefundRemainder` carries, for an exhaustive HTTP mapping. */
export const SETTLE_REFUND_REMAINDER_REJECTIONS = [
    'REFUND_AMOUNT_INVALID',
    'EXTERNAL_REFERENCE_INVALID',
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_CONFIRMED',
    'REFUND_CALL_UNANSWERED',
    'OTHER_REFUND_CALL_UNANSWERED',
    'REFUND_HAS_NO_ACCEPTED_CALL',
    'ACCEPTED_PART_NOT_ACCREDITED',
    'REMAINDER_AMOUNT_MISMATCH',
    'EXTERNAL_REFERENCE_ALREADY_SETTLED',
    'REMAINDER_NOT_FOUND_AT_PROVIDER',
    'REFUND_STATE_CHANGED'
] as const;

/** A rejection reason of `settleRefundRemainder`. */
export type SettleRefundRemainderRejection = (typeof SETTLE_REFUND_REMAINDER_REJECTIONS)[number];

function reject(
    code: ServiceErrorCode,
    message: string,
    reason: SettleRefundRemainderRejection
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

function refundNotFound(): ServiceError {
    return reject(ServiceErrorCode.NOT_FOUND, 'Refund not found', 'REFUND_NOT_FOUND');
}

/** The refund must still be `CONFIRMED`; RF3's own origin (CONFIRMED → EXECUTED). */
function assertConfirmed(status: string): void {
    if (!canRefundTransition({ transition: 'RF3', from: status as RefundStatus }).allowed)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            `Refund is ${status}, not CONFIRMED`,
            'REFUND_NOT_CONFIRMED'
        );
}

/**
 * The provider answered every call, accepted at least one, every accepted call is credited on the
 * charge (accepted is not credited), and the remainder is exactly what the credited part left
 * unpaid. Returns the credited sum, as the provider reports it.
 */
async function assertPartiallyCredited(input: {
    readonly tx: DrizzleClient;
    readonly refundId: string;
    readonly refundAmount: number;
    readonly remainder: number;
    readonly read: ChargeRefundsRead;
    readonly currency: string;
}): Promise<number> {
    const tally = await readRefundCallTally({ db: input.tx, refundId: input.refundId });
    if (tally.awaitingProviderAnswer)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'A provider call of this refund is still unanswered',
            'REFUND_CALL_UNANSWERED'
        );
    if (tally.acceptedIds.length === 0)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'The provider accepted no part of this refund',
            'REFUND_HAS_NO_ACCEPTED_CALL'
        );
    const credited = creditedAcceptedAmount({
        read: input.read,
        acceptedIds: tally.acceptedIds,
        currency: input.currency
    });
    const owed = input.refundAmount - credited;
    if (input.remainder !== owed)
        throw reject(
            ServiceErrorCode.VALIDATION_ERROR,
            `The remainder must be ${owed}: the refund is ${input.refundAmount} and the provider credited ${credited}`,
            'REMAINDER_AMOUNT_MISMATCH'
        );
    return credited;
}

/** What the decision reads from the provider before its transaction; null when there is nothing to read. */
type ProviderView = {
    readonly paymentId: string;
    readonly currency: string;
    readonly read: ChargeRefundsRead;
};

/**
 * Reads the payment's charge outside the transaction, like RF3. Returns null for a refund that is
 * absent or not on a payment: the transaction then rejects it in the contract's order.
 */
async function readProviderView(input: {
    readonly refundId: string;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<ProviderView | null> {
    const db = getDb();
    const [row] = await db
        .select({ paymentId: refunds.paymentId })
        .from(refunds)
        .where(eq(refunds.id, input.refundId))
        .limit(1);
    if (!row?.paymentId) return null;
    const [payment] = await db
        .select({ providerFactId: payments.providerFactId, currency: payments.currency })
        .from(payments)
        .where(eq(payments.id, row.paymentId))
        .limit(1);
    if (!payment) return null;
    const read = await readChargeRefunds({
        chargeId: payment.providerFactId,
        provider: input.provider,
        clock: input.clock
    });
    return { paymentId: row.paymentId, currency: payment.currency, read };
}

/** The refund's source, or a typed 404 when a refund names neither a payment nor a manual payment. */
function sourceOf(seen: {
    readonly paymentId: string | null;
    readonly manualPaymentId: string | null;
}): { readonly kind: 'PAYMENT' | 'MANUAL_PAYMENT'; readonly id: string } {
    if (seen.paymentId) return { kind: 'PAYMENT', id: seen.paymentId };
    if (seen.manualPaymentId) return { kind: 'MANUAL_PAYMENT', id: seen.manualPaymentId };
    // Unreachable while ck_refund_source holds (exactly one source); fail typed, never with ''.
    throw reject(ServiceErrorCode.NOT_FOUND, 'Refund has no source', 'REFUND_SOURCE_NOT_FOUND');
}

/**
 * The refund exists and the person may run action 14 on its subject. Runs in its own short
 * transaction before the provider is read, so a missing refund answers 404 and a person without
 * permission answers 403 without ever reaching the provider (error-contract order). The main
 * transaction checks both again under its own locks.
 */
async function assertSettleable(input: SettleRefundRemainderInput): Promise<void> {
    await getDb().transaction(async (tx: DrizzleClient) => {
        const [seen] = await tx
            .select({ paymentId: refunds.paymentId, manualPaymentId: refunds.manualPaymentId })
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1);
        if (!seen) throw refundNotFound();
        const locked = await lockRefundSource({ tx, source: sourceOf(seen) });
        const subjectId = await readRefundSubject({ tx, locked });
        authorizeRefundAction14({ actor: input.actor, subjectId });
    });
}

/** No other refund of the payment may have a call the provider has not answered (HOS-2517). */
async function assertNoOtherUnansweredCall(input: {
    readonly tx: DrizzleClient;
    readonly paymentId: string;
    readonly refundId: string;
}): Promise<void> {
    if (
        await hasOtherUnansweredRefundCall({
            db: input.tx,
            paymentId: input.paymentId,
            exceptRefundId: input.refundId
        })
    )
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'Another refund of this payment has a provider call still unanswered',
            'OTHER_REFUND_CALL_UNANSWERED'
        );
}

function stateChanged(): ServiceError {
    return reject(
        ServiceErrorCode.ALREADY_EXISTS,
        'Refund changed while it was being settled',
        'REFUND_STATE_CHANGED'
    );
}

/**
 * HOS-2406 — administrative action 14 over a `CONFIRMED` payment refund the provider accepted
 * only in part, once a person refunded the rest by hand from the provider panel. The refund row
 * closes `EXECUTED` for its full amount: its accepted `refund_call` rows keep the provider part,
 * and the row records the remainder the way action 14 records a panel refund
 * (`executed_via = 'EXTERNAL'`, `external_channel = 'PROVIDER_PANEL'`, `external_ref` the panel
 * refund id, `settled_by` the person; `confirmed_by` keeps whoever confirmed it). Accepted part +
 * remainder = refund amount, so `payment.refunded_amount` squares.
 *
 * The transition is RF3's (CONFIRMED → EXECUTED) and so is the close: the hung payments of the
 * charge are resolved with this refund (which lets a held page-charge mark be lifted, exactly as
 * after a normal execution), a late one-time charge's buyer is mailed, and P3/P4/P5 applies it
 * ({@link closeExecutedPaymentRefund}). No balance check is needed: the `CONFIRMED` row already
 * claims its full amount, and closing it does not change that.
 *
 * Accepted is not credited: before the transaction the charge is read by id, as RF3 reads it, and
 * every accepted call must be a credited provider refund on it (the credited sums are the
 * provider's, not what we asked), and the panel reference must be a credited provider refund of
 * exactly the remainder.
 *
 * The provider is read only after the refund is found and the person is authorized
 * ({@link assertSettleable}, its own short transaction), so 404 and 403 never reach the provider.
 * While another refund of the same payment has an unanswered provider call, nothing is settled:
 * its refund may be the one cited as the remainder (HOS-2517).
 *
 * Everything else runs in ONE transaction: the payment is locked `FOR UPDATE` before the refund (RF3's
 * order), step 3 authorizes from ACC_14's own permission (never roles), and the close is a
 * versioned `UPDATE ... WHERE status = 'CONFIRMED' AND version = <read>`.
 *
 * @param input - The refund, the remainder and its panel reference.
 * @param ports - The payment provider and the clock.
 * @returns The closed refund and its effect on the payment.
 * @throws ServiceError with a `reason` from `SETTLE_REFUND_REMAINDER_REJECTIONS`; never INTERNAL_ERROR for a rejection.
 */
export async function settleRefundRemainder(
    input: SettleRefundRemainderInput,
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<SettleRefundRemainderResult> {
    assertRefundAmount({ amount: input.amount });
    if (input.reference.length === 0 || input.reference.length > 255)
        throw reject(
            ServiceErrorCode.VALIDATION_ERROR,
            'The external reference must be 1 to 255 characters',
            'EXTERNAL_REFERENCE_INVALID'
        );
    await assertSettleable(input);
    const view = await readProviderView({
        refundId: input.refundId,
        provider: ports.provider,
        clock: ports.clock
    });
    try {
        return await getDb().transaction(async (tx: DrizzleClient) => {
            const [seen] = await tx
                .select({ paymentId: refunds.paymentId, manualPaymentId: refunds.manualPaymentId })
                .from(refunds)
                .where(eq(refunds.id, input.refundId))
                .limit(1);
            if (!seen) throw refundNotFound();
            const locked = await lockRefundSource({ tx, source: sourceOf(seen) });
            const subjectId = await readRefundSubject({ tx, locked });
            authorizeRefundAction14({ actor: input.actor, subjectId });
            if (locked.kind !== 'PAYMENT')
                throw reject(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'A manual payment refund has no provider call',
                    'REFUND_HAS_NO_ACCEPTED_CALL'
                );
            const [refund] = await tx
                .select()
                .from(refunds)
                .where(eq(refunds.id, input.refundId))
                .limit(1)
                .for('update');
            if (!refund) throw refundNotFound();
            // The source locked above must still be this refund's, and the one the provider read was for.
            if (refund.paymentId !== locked.payment.id || view?.paymentId !== locked.payment.id)
                throw stateChanged();
            assertConfirmed(refund.status);
            await assertNoOtherUnansweredCall({
                tx,
                paymentId: locked.payment.id,
                refundId: refund.id
            });
            const acceptedAmount = await assertPartiallyCredited({
                tx,
                refundId: refund.id,
                refundAmount: refund.amount,
                remainder: input.amount,
                read: view.read,
                currency: locked.payment.currency
            });
            await assertPanelReferenceUnused({ tx, reference: input.reference });
            assertRemainderAtProvider({
                read: view.read,
                reference: input.reference,
                remainder: input.amount,
                currency: locked.payment.currency
            });
            const [closed] = await tx
                .update(refunds)
                .set({
                    status: 'EXECUTED',
                    executedVia: 'EXTERNAL',
                    externalChannel: 'PROVIDER_PANEL',
                    externalRef: input.reference,
                    settledBy: input.actor.id,
                    version: refund.version + 1,
                    updatedAt: ports.clock.now()
                })
                .where(
                    and(
                        eq(refunds.id, refund.id),
                        eq(refunds.status, 'CONFIRMED'),
                        eq(refunds.version, refund.version)
                    )
                )
                .returning({ id: refunds.id });
            if (!closed) throw stateChanged();
            const applied = await closeExecutedPaymentRefund({
                tx,
                paymentId: locked.payment.id,
                refundId: refund.id,
                clock: ports.clock
            });
            return {
                refundId: refund.id,
                subjectId,
                acceptedAmount,
                remainderAmount: input.amount,
                paymentOutcome: applied.outcome,
                coverageReleased: 'coverageReleased' in applied ? applied.coverageReleased : false
            };
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === PANEL_REFERENCE_CONSTRAINT)
            throw externalReferenceAlreadySettled();
        throw error;
    }
}
