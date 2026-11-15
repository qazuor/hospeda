import { describe, expect, it } from 'vitest';
import {
    AmbiguousRefundAnswerError,
    type AmbiguousRefundAnswerInput
} from '../../../../src/services/billing/refund/ambiguous-refund-answer.error';

describe('HOS-2007 the ambiguous refund answer error carries what the operator needs', () => {
    it('names itself and states the refund and the reason in the message', () => {
        // Arrange
        const input: AmbiguousRefundAnswerInput = {
            kind: 'ORDER',
            refundId: 'r-1',
            refundCallKey: 'call-1',
            paymentId: 'payment-1',
            providerFactId: 'fact-1',
            orderId: 'order-1',
            expectedAmountMinor: 4000,
            reason: 'SEVERAL_NEW_ORDER_REFUNDS',
            candidates: []
        };

        // Act
        const error = new AmbiguousRefundAnswerError(input);

        // Assert
        expect(error.name).toBe('AmbiguousRefundAnswerError');
        expect(error.message).toBe(
            'Refund r-1 has an ambiguous provider answer (SEVERAL_NEW_ORDER_REFUNDS); it waits for a manual settlement'
        );
        expect(error instanceof Error).toBe(true);
    });

    it('keeps every field and copies the candidates', () => {
        // Arrange
        const candidates = [{ providerRefundId: 'provider-1', amountMinor: 4000 }];
        const input: AmbiguousRefundAnswerInput = {
            kind: 'PAYMENT',
            refundId: 'r-2',
            refundCallKey: 'call-2',
            paymentId: 'payment-2',
            providerFactId: 'fact-2',
            orderId: null,
            expectedAmountMinor: 4000,
            reason: 'SEVERAL_UNNAMED_PAYMENT_REFUNDS',
            candidates
        };

        // Act
        const error = new AmbiguousRefundAnswerError(input);
        candidates.push({ providerRefundId: 'provider-2', amountMinor: 4000 });

        // Assert
        expect(error).toMatchObject({
            kind: 'PAYMENT',
            refundId: 'r-2',
            refundCallKey: 'call-2',
            paymentId: 'payment-2',
            providerFactId: 'fact-2',
            orderId: null,
            expectedAmountMinor: 4000,
            reason: 'SEVERAL_UNNAMED_PAYMENT_REFUNDS'
        });
        expect(error.candidates).toEqual([{ providerRefundId: 'provider-1', amountMinor: 4000 }]);
        expect(error.candidateProviderRefundIds).toEqual(['provider-1']);
        expect(error.candidateAmountsMinor).toEqual([4000]);
        expect(error.candidateSummary).toBe('provider-1:4000');
    });

    it('keeps every own field flat for Sentry normalization', () => {
        const error = new AmbiguousRefundAnswerError({
            kind: 'ORDER',
            refundId: 'r',
            refundCallKey: 'k',
            paymentId: 'p',
            providerFactId: 'f',
            orderId: null,
            expectedAmountMinor: 1,
            reason: 'NO_NEW_ORDER_REFUND',
            candidates: []
        });
        for (const [key, value] of Object.entries(error)) {
            if (key === 'candidates') continue;
            expect(
                Array.isArray(value)
                    ? value.every(
                          (item) =>
                              item === null || ['string', 'number', 'boolean'].includes(typeof item)
                      )
                    : value === null || ['string', 'number', 'boolean'].includes(typeof value)
            ).toBe(true);
        }
    });
});
