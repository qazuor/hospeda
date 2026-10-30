import { describe, expect, it } from 'vitest';
import {
    OwnSubscriptionsResponseSchema,
    SubscriptionCancellationParamsSchema,
    SubscriptionCancellationPreviewResponseSchema,
    SubscriptionCancellationRequestSchema
} from '../../../src/api/billing/subscription-self-cancel.schema.js';

describe('self cancellation schemas', () => {
    it('TEST:1878:21 accepts an empty body or a valid closed cancellation reason only', () => {
        expect(SubscriptionCancellationRequestSchema.safeParse({}).success).toBe(true);
        expect(SubscriptionCancellationRequestSchema.safeParse({ reason: 'OTHER' }).success).toBe(
            true
        );
        expect(SubscriptionCancellationRequestSchema.safeParse({ reason: 'INVALID' }).success).toBe(
            false
        );
        expect(SubscriptionCancellationRequestSchema.safeParse({ extra: true }).success).toBe(
            false
        );
    });
    const ownSubscriptions = { subscriptions: [], deferredCourtesies: [] };
    const ownRow = {
        id: '00000000-0000-4000-8000-000000000001',
        vertical: 'accommodation',
        status: 'CANCEL_SCHEDULED',
        paymentMethod: 'CARD',
        serviceEndsAt: new Date().toISOString(),
        graceEndsAt: null,
        createdAt: new Date().toISOString(),
        plan: {
            slug: 'owner-basico',
            name: 'Basic',
            amount: 10000,
            currency: 'ARS',
            cycle: 'monthly'
        },
        nextCharge: null
    };
    it('requires paidAfterCancellation and accepts null or the addon outcome', () => {
        expect(
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                subscriptions: [{ ...ownRow, paidAfterCancellation: null }]
            }).success
        ).toBe(true);
        expect(
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                subscriptions: [{ ...ownRow, paidAfterCancellation: { recurringAddonsCut: true } }]
            }).success
        ).toBe(true);
        expect(
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                subscriptions: [ownRow]
            }).success
        ).toBe(false);
    });
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
    describe('TEST:1755:3 own subscription plan and next charge contract', () => {
        const validRow = { ...ownRow, paidAfterCancellation: null };
        const parseRow = (row: Record<string, unknown>) =>
            OwnSubscriptionsResponseSchema.safeParse({
                ...ownSubscriptions,
                subscriptions: [row]
            }).success;

        it('accepts a valid next charge', () => {
            expect(
                parseRow({
                    ...validRow,
                    nextCharge: {
                        at: '2026-10-15T12:00:00.000Z',
                        amount: 8000,
                        currency: 'ARS'
                    }
                })
            ).toBe(true);
        });

        it('rejects a missing plan', () => {
            const { plan: _plan, ...row } = validRow;
            expect(parseRow(row)).toBe(false);
        });

        it.each([1.5, -1])('rejects invalid plan amount %s', (amount) => {
            expect(parseRow({ ...validRow, plan: { ...ownRow.plan, amount } })).toBe(false);
        });

        it('rejects unsupported plan currency and cycle', () => {
            expect(parseRow({ ...validRow, plan: { ...ownRow.plan, currency: 'USD' } })).toBe(
                false
            );
            expect(parseRow({ ...validRow, plan: { ...ownRow.plan, cycle: 'weekly' } })).toBe(
                false
            );
        });

        it('rejects a non-datetime next charge', () => {
            expect(
                parseRow({
                    ...validRow,
                    nextCharge: { at: 'tomorrow', amount: 8000, currency: 'ARS' }
                })
            ).toBe(false);
        });
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
