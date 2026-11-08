/**
 * @file listing-policies-jsonld.test.ts
 * @description schema.org fields derived from house rules (HOS-2060).
 */

import { describe, expect, it } from 'vitest';
import { buildListingPolicyStructuredData } from '../../../src/lib/seo/listing-policies-jsonld';

const t = (_key: string, fallback?: string): string => fallback ?? _key;

describe('buildListingPolicyStructuredData', () => {
    it('omits every property when nothing is declared (absent is not false)', () => {
        // Arrange / Act / Assert
        expect(buildListingPolicyStructuredData({ policies: {}, t })).toEqual({});
    });

    it.each([
        ['yes', true],
        ['on_request', true],
        ['no', false]
    ] as const)('maps pets admission %s to petsAllowed=%s', (admission, expected) => {
        // Arrange / Act
        const result = buildListingPolicyStructuredData({ policies: { pets: { admission } }, t });

        // Assert
        expect(result.petsAllowed).toBe(expected);
    });

    it('takes the earliest check-in, the latest check-out and labels payments', () => {
        // Arrange
        const policies = {
            checkIn: { from: '14:00', to: '22:00' },
            checkOut: { from: '08:00', to: '10:30' },
            paymentMethods: ['cash', 'mercadopago'] as const
        };

        // Act
        const result = buildListingPolicyStructuredData({ policies, t });

        // Assert
        expect(result).toEqual({
            checkinTime: '14:00',
            checkoutTime: '10:30',
            paymentAccepted: 'Efectivo, Mercado Pago'
        });
    });
});
