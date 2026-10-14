import { describe, expect, it } from 'vitest';
import { ListingPurgePreviewResponseSchema } from '../../../src/api/billing/listing-purge-preview.schema.js';

describe('TEST:B13a:3b AC:B13a:4 the purge preview contract', () => {
    it('accepts an empty enumeration and a one-time add-on with an end date', () => {
        const empty = { lostAddons: [] };
        const oneTime = {
            lostAddons: [
                {
                    addonInstanceId: '550e8400-e29b-41d4-a716-446655440000',
                    name: 'Extra photos',
                    chargeKind: 'UNA_VEZ',
                    cycle: null,
                    price: 250000,
                    currency: 'ARS',
                    status: 'ACTIVE',
                    endsAt: '2026-12-31T23:59:59.000Z'
                }
            ]
        };

        expect(ListingPurgePreviewResponseSchema.parse(empty)).toEqual(empty);
        expect(ListingPurgePreviewResponseSchema.parse(oneTime)).toEqual(oneTime);
    });

    it.each([
        ['zero price', { price: 0 }],
        ['foreign currency', { currency: 'USD' }],
        ['unsupported status', { status: 'CANCELLED' }],
        ['unknown charge kind', { chargeKind: 'WEEKLY' }]
    ])('rejects %s', (_label, override) => {
        const validAddon = {
            addonInstanceId: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Extra photos',
            chargeKind: 'UNA_VEZ',
            cycle: null,
            price: 250000,
            currency: 'ARS',
            status: 'ACTIVE',
            endsAt: null
        };

        expect(() =>
            ListingPurgePreviewResponseSchema.parse({
                lostAddons: [{ ...validAddon, ...override }]
            })
        ).toThrow();
    });
});
