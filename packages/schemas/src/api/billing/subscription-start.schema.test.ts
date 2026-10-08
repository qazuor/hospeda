import { describe, expect, it } from 'vitest';
import {
    StartSubscriptionRejectionReasonSchema,
    StartSubscriptionRequestSchema,
    StartSubscriptionResponseSchema
} from './subscription-start.schema';

describe('TEST:B3:2 subscription start request', () => {
    it('accepts only a billing option identifier', () => {
        const billingOptionId = crypto.randomUUID();
        expect(StartSubscriptionRequestSchema.parse({ billingOptionId })).toEqual({
            billingOptionId
        });
        expect(
            StartSubscriptionRequestSchema.safeParse({ billingOptionId, vertical: 'accommodation' })
                .success
        ).toBe(false);
        expect(
            StartSubscriptionRequestSchema.safeParse({ billingOptionId, paymentToken: 'opaque' })
                .success
        ).toBe(false);
        expect(
            StartSubscriptionRequestSchema.safeParse({ billingOptionId: 'missing' }).success
        ).toBe(false);
    });

    it('keeps the four public rejection reasons closed', () => {
        expect(StartSubscriptionRejectionReasonSchema.options).toEqual([
            'PLAN_NOT_FOR_SALE',
            'PREVIOUS_ATTEMPT_CLOSING',
            'COMMITMENT_TAKEN',
            'CREATION_NOT_APPLIED'
        ]);
        expect(StartSubscriptionRejectionReasonSchema.safeParse('OTHER').success).toBe(false);
    });

    it('publishes only the sanitized checkout link field', () => {
        const response = {
            subscriptionId: crypto.randomUUID(),
            authorizationId: 'provider-id',
            checkoutUrl: 'https://example.test/checkout'
        };
        expect(StartSubscriptionResponseSchema.parse(response)).toEqual(response);
    });
});
