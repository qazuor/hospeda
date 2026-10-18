import { describe, expect, it } from 'vitest';
import {
    OwnSubscriptionsResponseSchema,
    SubscriptionCancellationParamsSchema,
    SubscriptionCancellationPreviewResponseSchema
} from '../../../src/api/billing/subscription-self-cancel.schema.js';

describe('self cancellation schemas', () => {
    const ownSubscriptions = { subscriptions: [], deferredCourtesies: [] };
    it('accepts an empty or populated deferred courtesy list', () => {
        expect(OwnSubscriptionsResponseSchema.safeParse(ownSubscriptions).success).toBe(true);
        expect(
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                deferredCourtesies: [
                    {
                        courtesyGrantId: '00000000-0000-4000-8000-000000000001',
                        vertical: 'accommodation',
                        balanceMonths: 3
                    }
                ]
            }).success
        ).toBe(true);
    });
    it.each([-1, 1.5])('rejects an invalid balanceMonths value %s', (balanceMonths) => {
        expect(
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                deferredCourtesies: [
                    {
                        courtesyGrantId: '00000000-0000-4000-8000-000000000001',
                        vertical: 'accommodation',
                        balanceMonths
                    }
                ]
            }).success
        ).toBe(false);
    });
    it('rejects a non-uuid courtesyGrantId', () => {
        expect(
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                deferredCourtesies: [
                    { courtesyGrantId: 'invalid', vertical: 'accommodation', balanceMonths: 3 }
                ]
            }).success
        ).toBe(false);
    });
    it('accepts every preview origin', () => {
        const base = {
            subscriptionId: '00000000-0000-4000-8000-000000000001',
            vertical: 'ACCOMMODATION',
            paymentMethod: 'CARD' as const,
            addons: []
        };
        for (const value of [
            { ...base, origin: 'ACTIVE', serviceEndsAt: new Date().toISOString() },
            { ...base, origin: 'GRACE_PERIOD', graceEndsAt: new Date().toISOString() },
            { ...base, origin: 'SUSPENDED' },
            { ...base, origin: 'CANCEL_SCHEDULED', serviceEndsAt: new Date().toISOString() }
        ])
            expect(SubscriptionCancellationPreviewResponseSchema.safeParse(value).success).toBe(
                true
            );
    });
    it('rejects unknown origins, addon effects and malformed ids', () => {
        expect(
            SubscriptionCancellationPreviewResponseSchema.safeParse({ origin: 'PAUSED' }).success
        ).toBe(false);
        expect(
            SubscriptionCancellationPreviewResponseSchema.safeParse({
                subscriptionId: '00000000-0000-4000-8000-000000000001',
                vertical: 'X',
                paymentMethod: 'CARD',
                origin: 'SUSPENDED',
                addons: [
                    {
                        addonInstanceId: '00000000-0000-4000-8000-000000000002',
                        name: 'x',
                        price: 1,
                        currency: 'ARS',
                        cycle: 'monthly',
                        whenOff: 'LATER'
                    }
                ]
            }).success
        ).toBe(false);
        expect(
            SubscriptionCancellationParamsSchema.safeParse({ subscriptionId: 'nope' }).success
        ).toBe(false);
    });
});
