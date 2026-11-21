import { refunds } from '@repo/db';
import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AmbiguousRefundAnswerError } from '../../../src/services/billing/refund/ambiguous-refund-answer.error.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './support/refund-confirm-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);
const skip = !isServiceTestDbAvailable();

/** Errors the logger hands to the capture hook (the API turns them into Sentry events). */
function capturing(): unknown[] {
    const captured: unknown[] = [];
    registerCaptureHook((error) => captured.push(error));
    return captured;
}

/** The provider with its first refund answer lost (UNAVAILABLE) and later answers optionally replaced. */
function lossyProvider(provider: PaymentProvider, answerAfterLoss?: { refundId: string }) {
    let first = true;
    return new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    const answer = await target.refund(input);
                    if (first) {
                        first = false;
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'lost response'
                        });
                    }
                    return answerAfterLoss ?? answer;
                };
            return Reflect.get(target, property, receiver);
        }
    });
}

/** A refund settled by hand from the provider panel (action 14) citing `externalRef`. */
async function panelSettledRefund(input: {
    readonly paymentId: string;
    readonly amount: number;
    readonly externalRef: string;
}): Promise<void> {
    await getServiceTestDb().insert(refunds).values({
        paymentId: input.paymentId,
        amount: input.amount,
        reason: 'OTHER',
        status: 'EXECUTED',
        executedVia: 'EXTERNAL',
        externalChannel: 'PROVIDER_PANEL',
        externalRef: input.externalRef
    });
}

/** Confirms a refund through `provider`, leaving its single call unanswered. */
async function stuck(provider: (base: PaymentProvider) => PaymentProvider) {
    const seeded = await refundConfirmFixture(10000, 4000);
    const wrapped = provider(seeded.fixture.provider);
    const confirmed = await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider: wrapped }
    );
    expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
    return { seeded, wrapped };
}

/** The call and key rows the resend answered for `key`. */
async function rowsFor(refundId: string, key: string | undefined) {
    const rows = await refundConfirmRows(refundId);
    return {
        call: rows.calls.find((call) => call.idempotencyKey === key),
        key: rows.keys.find((row) => row.key === key)
    };
}

function citedFor(captured: unknown[], refundId: string) {
    return captured.filter(
        (error): error is AmbiguousRefundAnswerError =>
            error instanceof AmbiguousRefundAnswerError && error.refundId === refundId
    );
}

describe('HOS-2517 a resend never binds a provider refund id that already settles something', () => {
    it.skipIf(skip)(
        'a direct answer naming another refund panel reference stays unanswered and alerts',
        async () => {
            // Arrange
            const citedId = `panel-${crypto.randomUUID()}`;
            const { seeded, wrapped } = await stuck((base) =>
                lossyProvider(base, { refundId: citedId })
            );
            await panelSettledRefund({
                paymentId: seeded.payment.id,
                amount: 1000,
                externalRef: citedId
            });
            const captured = capturing();

            // Act
            const result = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: wrapped }
            );

            // Assert
            const rows = await rowsFor(seeded.refundId, result.outcomes[0]?.idempotencyKey);
            expect(result.outcomes.map(({ outcome }) => outcome)).toEqual([
                'AWAITING_PROVIDER_ANSWER'
            ]);
            expect(rows.key?.completedAt).toBeNull();
            expect(rows.call?.providerRefundId).toBeNull();
            expect(citedFor(captured, seeded.refundId)).toEqual([
                expect.objectContaining({
                    reason: 'PROVIDER_REFUND_ALREADY_CITED',
                    candidateProviderRefundIds: [citedId]
                })
            ]);
        }
    );

    it.skipIf(skip)(
        'a direct answer naming the provider id of another call stays unanswered and alerts',
        async () => {
            // Arrange
            const other = await refundConfirmFixture(10000, 2000);
            const sent = await confirmRefund(
                { actor: other.actor, refundId: other.refundId },
                { clock: other.fixture.clock, provider: other.fixture.provider }
            );
            expect(sent.outcome).toBe('SENT');
            const otherCallId = (await refundConfirmRows(other.refundId)).calls.find(
                (call) => call.providerRefundId !== null
            )?.providerRefundId;
            expect(otherCallId).toEqual(expect.any(String));
            const { seeded, wrapped } = await stuck((base) =>
                lossyProvider(base, { refundId: otherCallId ?? '' })
            );
            const captured = capturing();

            // Act
            const result = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: wrapped }
            );

            // Assert
            const rows = await rowsFor(seeded.refundId, result.outcomes[0]?.idempotencyKey);
            expect(result.outcomes.map(({ outcome }) => outcome)).toEqual([
                'AWAITING_PROVIDER_ANSWER'
            ]);
            expect(rows.key?.completedAt).toBeNull();
            expect(citedFor(captured, seeded.refundId)).toEqual([
                expect.objectContaining({ reason: 'PROVIDER_REFUND_ALREADY_CITED' })
            ]);
        }
    );

    it.skipIf(skip)(
        'an empty answer never reassigns the call to a refund already cited as a panel reference',
        async () => {
            // Arrange: the lost first call landed; the replay answers 200 with an empty body (RF-6).
            const { seeded, wrapped } = await stuck((base) => lossyProvider(base));
            const read = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });
            const landed = read.snapshot.refunds.map(({ refundId }) => refundId);
            expect(landed).toHaveLength(1);
            await panelSettledRefund({
                paymentId: seeded.payment.id,
                amount: 4000,
                externalRef: landed[0] ?? ''
            });
            const captured = capturing();

            // Act
            const result = await resendUnansweredRefundCalls(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: wrapped }
            );

            // Assert
            const rows = await rowsFor(seeded.refundId, result.outcomes[0]?.idempotencyKey);
            expect(result.outcomes.map(({ outcome }) => outcome)).toEqual([
                'AWAITING_PROVIDER_ANSWER'
            ]);
            expect(rows.call?.providerRefundId).toBeNull();
            expect(citedFor(captured, seeded.refundId)).toEqual([
                expect.objectContaining({
                    reason: 'NO_UNNAMED_PAYMENT_REFUND',
                    candidateProviderRefundIds: []
                })
            ]);
        }
    );

    it.skipIf(skip)('an uncited answer is still bound and the call completes', async () => {
        // Arrange
        const { seeded, wrapped } = await stuck((base) => lossyProvider(base));

        // Act
        const result = await resendUnansweredRefundCalls(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: wrapped }
        );

        // Assert
        const rows = await rowsFor(seeded.refundId, result.outcomes[0]?.idempotencyKey);
        expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(['SENT']);
        expect(rows.call?.providerRefundId).toEqual(expect.any(String));
    });
});
