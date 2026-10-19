import { describe, expect, it } from 'vitest';
import { PricingSituationResponseSchema } from '../../../src/api/billing/pricing-situation.schema.js';

describe('PricingSituationResponseSchema', () => {
    it('accepts every pricing situation', () => {
        const values = [
            { situation: 'FIRST_USE', trialDays: 14 },
            { situation: 'TRIAL' },
            { situation: 'CHECKOUT' },
            {
                situation: 'SUBSCRIBED',
                status: 'ACTIVE',
                planVersionId: crypto.randomUUID(),
                billingOptionId: crypto.randomUUID()
            },
            { situation: 'COVERED' },
            { situation: 'NO_PLANS' },
            { situation: 'TOURIST_VIP_INHERITED' }
        ];
        for (const value of values)
            expect(PricingSituationResponseSchema.safeParse(value).success).toBe(true);
    });

    it('rejects invalid trial length, commitment status, and unknown situations', () => {
        const id = crypto.randomUUID();
        expect(
            PricingSituationResponseSchema.safeParse({ situation: 'FIRST_USE', trialDays: 0 })
                .success
        ).toBe(false);
        expect(
            PricingSituationResponseSchema.safeParse({
                situation: 'SUBSCRIBED',
                status: 'CANCELLED',
                planVersionId: id,
                billingOptionId: id
            }).success
        ).toBe(false);
        expect(PricingSituationResponseSchema.safeParse({ situation: 'UNKNOWN' }).success).toBe(
            false
        );
    });
});
