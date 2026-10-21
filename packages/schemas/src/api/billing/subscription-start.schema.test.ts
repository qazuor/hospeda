import { describe, expect, it } from 'vitest';
import {
    StartSubscriptionRejectionReasonSchema,
    StartSubscriptionRequestSchema,
    StartSubscriptionResponseSchema
} from './subscription-start.schema';

describe('TEST:B3:2 subscription start request', () => {
    it('accepts only a billing option identifier and the declared payer email', () => {
        const billingOptionId = crypto.randomUUID();
        const payerEmail = 'payer@example.test';
        expect(StartSubscriptionRequestSchema.parse({ billingOptionId, payerEmail })).toEqual({
            billingOptionId,
            payerEmail
        });
        expect(StartSubscriptionRequestSchema.safeParse({ billingOptionId }).success).toBe(false);
        expect(
            StartSubscriptionRequestSchema.safeParse({
                billingOptionId,
                payerEmail,
                vertical: 'accommodation'
            }).success
        ).toBe(false);
        expect(
            StartSubscriptionRequestSchema.safeParse({
                billingOptionId,
                payerEmail,
                paymentToken: 'opaque'
            }).success
        ).toBe(false);
        expect(
            StartSubscriptionRequestSchema.safeParse({ billingOptionId: 'missing' }).success
        ).toBe(false);
        const oversizedEmail = `a@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(62)}`;
        expect(oversizedEmail).toHaveLength(256);
        for (const invalidEmail of ['', '   ', 'not-an-email', oversizedEmail]) {
            expect(
                StartSubscriptionRequestSchema.safeParse({
                    billingOptionId,
                    payerEmail: invalidEmail
                }).success
            ).toBe(false);
        }
        expect(
            StartSubscriptionRequestSchema.parse({ billingOptionId, payerEmail: ' a@b.co ' })
                .payerEmail
        ).toBe('a@b.co');
    });

    it('keeps the four public rejection reasons closed', () => {
        expect(StartSubscriptionRejectionReasonSchema.options).toEqual([
            'PLAN_NOT_FOR_SALE',
            'PREVIOUS_ATTEMPT_CLOSING',
            'COMMITMENT_TAKEN',
            'TOURIST_VIP_INHERITED',
            'CREATION_NOT_APPLIED'
        ]);
        expect(StartSubscriptionRejectionReasonSchema.safeParse('OTHER').success).toBe(false);
    });

    it('publishes only the sanitized checkout link field', () => {
        const response = {
            subscriptionId: crypto.randomUUID(),
            authorizationId: 'provider-id',
            checkoutUrl: 'https://example.test/checkout',
            vertical: 'accommodation',
            authorizationWindowEndsAt: '2026-10-11T20:00:00.000Z'
        };
        expect(StartSubscriptionResponseSchema.parse(response)).toEqual(response);
    });

    // B3 UI (B3.md:1045-1053)
    it('requires the persisted vertical and authorization window end', () => {
        const response = {
            subscriptionId: crypto.randomUUID(),
            authorizationId: 'provider-id',
            checkoutUrl: 'https://example.test/checkout',
            vertical: 'accommodation',
            authorizationWindowEndsAt: '2026-10-11T20:00:00.000Z'
        };
        expect(
            StartSubscriptionResponseSchema.safeParse({
                subscriptionId: response.subscriptionId,
                authorizationId: response.authorizationId,
                checkoutUrl: response.checkoutUrl,
                authorizationWindowEndsAt: response.authorizationWindowEndsAt
            }).success
        ).toBe(false);
        expect(
            StartSubscriptionResponseSchema.safeParse({
                subscriptionId: response.subscriptionId,
                authorizationId: response.authorizationId,
                checkoutUrl: response.checkoutUrl,
                vertical: response.vertical
            }).success
        ).toBe(false);
        expect(
            StartSubscriptionResponseSchema.safeParse({
                ...response,
                authorizationWindowEndsAt: '2026-10-11T20:00:00.000'
            }).success
        ).toBe(false);
        expect(
            StartSubscriptionResponseSchema.safeParse({ ...response, vertical: 'unknown' }).success
        ).toBe(false);
    });
});
