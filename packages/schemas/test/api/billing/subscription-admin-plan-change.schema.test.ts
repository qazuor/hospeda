import { describe, expect, it } from 'vitest';
import {
    AdminSubscriptionPlanChangeOptionsResponseSchema,
    AdminSubscriptionPlanChangeRequestSchema
} from '../../../src/api/billing/subscription-admin-plan-change.schema.js';

describe('AC:B8b:22 administrative plan change request', () => {
    it('requires the plan identity, direction, and current subscription cycle preview fields', () => {
        const uuid = crypto.randomUUID();
        const base = {
            subscriptionId: crypto.randomUUID(),
            vertical: 'accommodation',
            nextChargeAt: null,
            currentCycle: 'monthly',
            options: [
                {
                    billingOptionId: uuid,
                    planId: crypto.randomUUID(),
                    planName: 'Professional',
                    planSlug: 'owner-pro',
                    planVersionId: crypto.randomUUID(),
                    cycle: 'monthly',
                    amountMinor: 10000,
                    currency: 'ARS',
                    current: true,
                    direction: 'NONE'
                }
            ]
        };
        expect(AdminSubscriptionPlanChangeOptionsResponseSchema.safeParse(base).success).toBe(true);
        expect(
            AdminSubscriptionPlanChangeOptionsResponseSchema.safeParse({
                ...base,
                options: [{ ...base.options[0], direction: 'SIDEWAYS' }]
            }).success
        ).toBe(false);
    });
    const body = {
        billingOptionId: crypto.randomUUID(),
        expectedStatus: 'ACTIVE',
        confirmed: true
    };

    it('accepts an explicit confirmation', () => {
        expect(AdminSubscriptionPlanChangeRequestSchema.safeParse(body).success).toBe(true);
    });

    it.each([
        { billingOptionId: crypto.randomUUID(), expectedStatus: 'ACTIVE' },
        { ...body, confirmed: false },
        { ...body, payerEmail: 'customer@example.test' },
        { ...body, returnUrl: 'https://example.test/return' }
    ])('rejects an unconfirmed or unsupported request: %j', (input) => {
        expect(AdminSubscriptionPlanChangeRequestSchema.safeParse(input).success).toBe(false);
    });
});
