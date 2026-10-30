import { describe, expect, it } from 'vitest';
import {
    AdminSubscriptionCancellationExpectedOriginSchema,
    AdminSubscriptionCancellationRequestSchema,
    AdminSubscriptionCancellationResponseSchema
} from '../../../src/api/billing/subscription-admin-cancel.schema.js';

describe('TEST:1696:6 AC:1696:1 admin cancellation schemas', () => {
    it('TEST:1878:22 accepts an optional closed cancellation reason', () => {
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({ expectedOrigin: 'ACTIVE' })
                .success
        ).toBe(true);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({
                expectedOrigin: 'ACTIVE',
                reason: 'OTHER'
            }).success
        ).toBe(true);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({
                expectedOrigin: 'ACTIVE',
                reason: 'INVALID'
            }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({
                expectedOrigin: 'ACTIVE',
                extra: true
            }).success
        ).toBe(false);
    });
    it.each([
        'ACTIVE',
        'GRACE_PERIOD',
        'SUSPENDED'
    ])('accepts expected origin %s', (expectedOrigin) => {
        expect(
            AdminSubscriptionCancellationExpectedOriginSchema.safeParse(expectedOrigin).success
        ).toBe(true);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({ expectedOrigin }).success
        ).toBe(true);
    });

    it('rejects unsupported origins, extra fields, and invalid notes', () => {
        for (const expectedOrigin of ['CANCEL_SCHEDULED', 'PAUSED'])
            expect(
                AdminSubscriptionCancellationRequestSchema.safeParse({ expectedOrigin }).success
            ).toBe(false);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({
                expectedOrigin: 'ACTIVE',
                extra: true
            }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({
                expectedOrigin: 'ACTIVE',
                note: '   '
            }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCancellationRequestSchema.safeParse({
                expectedOrigin: 'ACTIVE',
                note: 'x'.repeat(2001)
            }).success
        ).toBe(false);
    });

    it('accepts all outcomes and requires null transition for already outcomes', () => {
        const base = {
            subscriptionId: '00000000-0000-4000-8000-000000000001',
            serviceEndsAt: new Date().toISOString()
        };
        const variants = [
            { ...base, outcome: 'SCHEDULED', transition: 'S11', cancelCall: 'SENT' },
            { ...base, outcome: 'ALREADY_SCHEDULED', transition: null },
            { ...base, outcome: 'CANCELLED', transition: 'S23', cancelCall: 'NOT_NEEDED' },
            { ...base, outcome: 'ALREADY_CANCELLED', transition: null, serviceEndsAt: null }
        ];
        for (const variant of variants)
            expect(AdminSubscriptionCancellationResponseSchema.safeParse(variant).success).toBe(
                true
            );
        expect(
            AdminSubscriptionCancellationResponseSchema.safeParse({
                ...base,
                outcome: 'ALREADY_SCHEDULED',
                transition: 'S11'
            }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCancellationResponseSchema.safeParse({
                ...base,
                outcome: 'ALREADY_CANCELLED',
                transition: null,
                cancelCall: 'SENT'
            }).success
        ).toBe(false);
    });
});
