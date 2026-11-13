import { describe, expect, it } from 'vitest';
import { AdminSubscriptionPlanChangeRequestSchema } from '../../../src/api/billing/subscription-admin-plan-change.schema.js';

describe('AC:B8b:22 administrative plan change request', () => {
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
