import { describe, expect, it } from 'vitest';
import { PublicPlanCatalogResponseSchema } from '../../../src/api/billing/public-plan-catalog.schema.js';

const id = '11111111-1111-4111-8111-111111111111';
const plan = {
    planId: id,
    planVersionId: id,
    slug: 'standard',
    name: 'Standard',
    description: null,
    pricingOrder: 1,
    rank: 1,
    trialDays: 14,
    inheritsTouristVip: false,
    entitlements: ['listing.publish'],
    limits: { listings: 2 },
    billingOptions: [
        { id, cycle: 'monthly', amount: 1000, currency: 'ARS' },
        {
            id: '22222222-2222-4222-8222-222222222222',
            cycle: 'annual',
            amount: 10000,
            currency: 'ARS'
        }
    ]
};
const floor = {
    planId: id,
    planVersionId: id,
    slug: 'free',
    name: 'Free',
    description: null,
    pricingOrder: 0,
    rank: 0,
    trialDays: 0,
    entitlements: ['favorites'],
    limits: { listings: 0 }
};

describe('PublicPlanCatalogResponseSchema', () => {
    it('accepts one plan with two billing options', () => {
        expect(
            PublicPlanCatalogResponseSchema.safeParse({
                vertical: 'accommodation',
                plans: [plan],
                floor
            }).success
        ).toBe(true);
    });

    it('accepts empty plans and billing options', () => {
        expect(
            PublicPlanCatalogResponseSchema.safeParse({
                vertical: 'tourist',
                plans: [{ ...plan, billingOptions: [] }],
                floor: null
            }).success
        ).toBe(true);
    });

    it('rejects a floor with billing options', () => {
        expect(
            PublicPlanCatalogResponseSchema.safeParse({
                vertical: 'tourist',
                plans: [],
                floor: { ...floor, billingOptions: [] }
            }).success
        ).toBe(false);
    });

    it.each([
        { vertical: 'partner', plans: [], floor: null },
        {
            vertical: 'tourist',
            plans: [{ ...plan, billingOptions: [{ ...plan.billingOptions[0], currency: 'USD' }] }],
            floor: null
        },
        {
            vertical: 'tourist',
            plans: [{ ...plan, billingOptions: [{ ...plan.billingOptions[0], cycle: 'weekly' }] }],
            floor: null
        },
        {
            vertical: 'tourist',
            plans: [{ ...plan, billingOptions: [{ ...plan.billingOptions[0], amount: 1.5 }] }],
            floor: null
        }
    ])('rejects invalid catalog data', (data) => {
        expect(PublicPlanCatalogResponseSchema.safeParse(data).success).toBe(false);
    });
});
