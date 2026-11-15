import { describe, expect, it } from 'vitest';
import { AddonOffersResponseSchema } from '../../../src/api/billing/addon-offers.schema';

describe('addon offers response', () => {
    const offer = {
        productId: crypto.randomUUID(),
        addonVersionId: crypto.randomUUID(),
        name: 'Listing boost',
        description: null,
        chargeKind: 'PERIODICO',
        cycle: 'monthly',
        price: 5000,
        currency: 'ARS',
        compatibleVerticals: ['accommodation'],
        scopeType: 'LISTING',
        validity: 'WHILE_SUBSCRIPTION_ALIVE',
        validityDays: null,
        freeUnderGrantVerticals: ['accommodation']
    };

    it('accepts a complete offer and an empty catalog', () => {
        expect(AddonOffersResponseSchema.parse({ items: [offer] }).items).toHaveLength(1);
        expect(AddonOffersResponseSchema.parse({ items: [] })).toEqual({ items: [] });
    });

    it('rejects missing policy, invalid price and extra fields', () => {
        const { scopeType: _scopeType, ...withoutPolicy } = offer;
        expect(AddonOffersResponseSchema.safeParse({ items: [withoutPolicy] }).success).toBe(false);
        expect(
            AddonOffersResponseSchema.safeParse({ items: [{ ...offer, price: 0 }] }).success
        ).toBe(false);
        expect(
            AddonOffersResponseSchema.safeParse({ items: [{ ...offer, other: true }] }).success
        ).toBe(false);
    });
});
