/**
 * Unit tests for the admin action 8 revocation contract (HOS-1543, ACC:8, S36).
 *
 * @module test/api/billing/subscription-revocation.schema
 */

import { describe, expect, it } from 'vitest';
import {
    SubscriptionRevocationParamsSchema,
    SubscriptionRevocationPreviewResponseSchema,
    SubscriptionRevocationRequestSchema,
    SubscriptionRevocationResponseSchema
} from '../../../src/api/billing/subscription-revocation.schema.js';

const SUBSCRIPTION_ID = '7a1f4c2e-3b5d-4e6f-8a9b-0c1d2e3f4a5b';
const PREDECESSOR_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const PAYMENT_ID = '9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0';
const REFUND_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

const preview = {
    subscriptionId: SUBSCRIPTION_ID,
    origin: 'ACTIVE',
    payment: {
        source: 'PAYMENT',
        id: PAYMENT_ID,
        amount: 10000,
        currency: 'ARS',
        chargedAt: '2026-10-01T03:00:00.000Z',
        ownerSubscriptionId: SUBSCRIPTION_ID
    },
    windowEndsAt: '2026-10-12T03:00:00.000Z',
    effects: { cancelsAuthorization: true, endsServiceAt: 'NOW', requestsRefund: true }
} as const;

const response = {
    subscriptionId: SUBSCRIPTION_ID,
    status: 'CANCELLED',
    origin: 'ACTIVE',
    serviceEndedAt: '2026-10-05T12:00:00.000Z',
    refundId: REFUND_ID,
    refundAmount: 10000,
    payment: { source: 'PAYMENT', id: PAYMENT_ID },
    cancelCall: 'SENT'
} as const;

describe('SubscriptionRevocationParamsSchema', () => {
    it('accepts a uuid and rejects anything else', () => {
        expect(
            SubscriptionRevocationParamsSchema.safeParse({ subscriptionId: SUBSCRIPTION_ID })
                .success
        ).toBe(true);
        expect(
            SubscriptionRevocationParamsSchema.safeParse({ subscriptionId: 'nope' }).success
        ).toBe(false);
    });
});

describe('SubscriptionRevocationPreviewResponseSchema', () => {
    it.each([
        'ACTIVE',
        'GRACE_PERIOD',
        'CANCEL_SCHEDULED',
        'PAUSED'
    ] as const)('accepts the preview from %s', (origin) => {
        expect(
            SubscriptionRevocationPreviewResponseSchema.safeParse({ ...preview, origin }).success
        ).toBe(true);
    });

    it('accepts a manual payment of a predecessor with no currency and no authorization to cancel', () => {
        // Arrange
        const manual = {
            ...preview,
            payment: {
                ...preview.payment,
                source: 'MANUAL_PAYMENT',
                currency: null,
                ownerSubscriptionId: PREDECESSOR_ID
            },
            effects: { ...preview.effects, cancelsAuthorization: false }
        };

        // Act
        const result = SubscriptionRevocationPreviewResponseSchema.safeParse(manual);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a negative amount and a preview that does not request the refund', () => {
        expect(
            SubscriptionRevocationPreviewResponseSchema.safeParse({
                ...preview,
                payment: { ...preview.payment, amount: -1 }
            }).success
        ).toBe(false);
        expect(
            SubscriptionRevocationPreviewResponseSchema.safeParse({
                ...preview,
                effects: { ...preview.effects, requestsRefund: false }
            }).success
        ).toBe(false);
    });
});

describe('SubscriptionRevocationRequestSchema', () => {
    it('accepts the expected payment with and without a note, trimming it', () => {
        expect(
            SubscriptionRevocationRequestSchema.safeParse({ expectedPaymentId: PAYMENT_ID }).success
        ).toBe(true);
        expect(
            SubscriptionRevocationRequestSchema.parse({
                expectedPaymentId: PAYMENT_ID,
                note: '  asked by phone  '
            }).note
        ).toBe('asked by phone');
    });

    it('rejects a missing or non-uuid expected payment', () => {
        expect(SubscriptionRevocationRequestSchema.safeParse({}).success).toBe(false);
        expect(
            SubscriptionRevocationRequestSchema.safeParse({ expectedPaymentId: 'nope' }).success
        ).toBe(false);
    });

    it('rejects an extra key', () => {
        expect(
            SubscriptionRevocationRequestSchema.safeParse({
                expectedPaymentId: PAYMENT_ID,
                amount: 1
            }).success
        ).toBe(false);
    });

    it('rejects an empty note and a note of 2001 characters, accepts one of 2000', () => {
        expect(
            SubscriptionRevocationRequestSchema.safeParse({
                expectedPaymentId: PAYMENT_ID,
                note: '   '
            }).success
        ).toBe(false);
        expect(
            SubscriptionRevocationRequestSchema.safeParse({
                expectedPaymentId: PAYMENT_ID,
                note: 'x'.repeat(2001)
            }).success
        ).toBe(false);
        expect(
            SubscriptionRevocationRequestSchema.safeParse({
                expectedPaymentId: PAYMENT_ID,
                note: 'x'.repeat(2000)
            }).success
        ).toBe(true);
    });
});

describe('SubscriptionRevocationResponseSchema', () => {
    it.each([
        'SENT',
        'NOT_NEEDED',
        'NOTICE_PENDING',
        'FAILED',
        'NOT_APPLICABLE'
    ] as const)('accepts the cancel call %s', (cancelCall) => {
        expect(
            SubscriptionRevocationResponseSchema.safeParse({ ...response, cancelCall }).success
        ).toBe(true);
    });

    it.each([
        'NO_RECIPIENT',
        'DELIVERY_EXHAUSTED'
    ] as const)('accepts escalated %s', (escalated) => {
        expect(
            SubscriptionRevocationResponseSchema.safeParse({ ...response, escalated }).success
        ).toBe(true);
    });

    it('accepts a manual payment source', () => {
        expect(
            SubscriptionRevocationResponseSchema.safeParse({
                ...response,
                payment: { source: 'MANUAL_PAYMENT', id: PAYMENT_ID },
                cancelCall: 'NOT_APPLICABLE'
            }).success
        ).toBe(true);
    });

    it('rejects a status other than CANCELLED and an unknown cancel call', () => {
        expect(
            SubscriptionRevocationResponseSchema.safeParse({ ...response, status: 'ACTIVE' })
                .success
        ).toBe(false);
        expect(
            SubscriptionRevocationResponseSchema.safeParse({ ...response, cancelCall: 'MAYBE' })
                .success
        ).toBe(false);
    });
});
