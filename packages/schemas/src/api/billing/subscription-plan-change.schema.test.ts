import { describe, expect, it } from 'vitest';
import {
    SubscriptionPlanChangeRequestSchema,
    SubscriptionPlanChangeResponseSchema
} from './subscription-plan-change.schema.js';

const id = '11111111-1111-4111-8111-111111111111';

describe('subscription plan change contract', () => {
    it.each([
        {
            outcome: 'SUCCESSION',
            subscriptionId: id,
            checkoutUrl: 'https://example.test/checkout',
            firstChargeAt: '2026-12-01T00:00:00.000Z',
            creditDays: 4
        },
        {
            outcome: 'DOWNGRADE',
            effectiveAt: '2026-12-01T00:00:00.000Z',
            amountMinor: 1200,
            surplus: { applicable: false }
        },
        { outcome: 'REGRET', amountMinor: 1500 }
    ])('parses $outcome', (result) => {
        expect(SubscriptionPlanChangeResponseSchema.parse(result)).toMatchObject(result);
    });

    it('requires a destination and rejects extra fields', () => {
        expect(SubscriptionPlanChangeRequestSchema.safeParse({}).success).toBe(false);
        expect(
            SubscriptionPlanChangeRequestSchema.safeParse({ billingOptionId: id, returnUrl: 'x' })
                .success
        ).toBe(false);
    });
});
