/**
 * HOS-910 regression: once a host saved a postal address or a minimum stay,
 * the editor could not empty it again — the cleared value was rejected at the
 * HTTP boundary and the row had to be fixed by hand in the database.
 *
 * - Address: the editor sends `''` for an emptied field; `street`/`number`/
 *   `floor`/`apartment` carried `.min(N)` with no `''` escape (HOS-792 gave
 *   `seoTitle`/`seoDescription` that escape; the address never got it).
 * - Minimum stay: since HOS-2060 it lives in the `policies` JSONB, and the
 *   editor clears it by sending `policies: { minNights: null }`.
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationLocationSchema,
    AccommodationUpdateHttpSchema,
    AccommodationUpdateInputSchema,
    httpToDomainAccommodationUpdate
} from '../../../src/index.js';

const ADDRESS_FIELDS = ['street', 'number', 'floor', 'apartment'] as const;

describe('HOS-910 — clearing the postal address', () => {
    it.each(ADDRESS_FIELDS)('accepts an empty %s at the HTTP boundary', (field) => {
        // Act
        const result = AccommodationUpdateHttpSchema.safeParse({ [field]: '' });

        // Assert
        expect(result.success).toBe(true);
    });

    it.each(ADDRESS_FIELDS)('maps an empty %s through to the domain location', (field) => {
        // Arrange
        const body = AccommodationUpdateHttpSchema.partial()
            .strict()
            .parse({ [field]: '' });

        // Act
        const domain = httpToDomainAccommodationUpdate(body);

        // Assert
        expect(domain.location).toEqual({ [field]: '' });
        expect(AccommodationUpdateInputSchema.safeParse(domain).success).toBe(true);
    });

    it('accepts a cleared address in the stored location', () => {
        const result = AccommodationLocationSchema.safeParse({
            street: '',
            number: '',
            floor: '',
            apartment: ''
        });
        expect(result.success).toBe(true);
    });

    it.each([
        ['a one-character street', { street: 'A' }],
        ['a street over 50 characters', { street: 'A'.repeat(51) }],
        ['a number over 10 characters', { number: '1'.repeat(11) }],
        ['a non-string floor', { floor: 3 }]
    ])('still rejects %s', (_label, input) => {
        expect(AccommodationUpdateHttpSchema.safeParse(input).success).toBe(false);
        expect(AccommodationLocationSchema.safeParse(input).success).toBe(false);
    });

    it('reports a translatable key for a non-string address value', () => {
        const result = AccommodationLocationSchema.safeParse({ floor: 3 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
            'zodError.accommodation.location.floor.required'
        );
    });
});

describe('HOS-910 — clearing the minimum stay', () => {
    it('accepts policies.minNights: null at the HTTP boundary', () => {
        const result = AccommodationUpdateHttpSchema.partial()
            .strict()
            .safeParse({ policies: { minNights: null } });
        expect(result.success).toBe(true);
    });

    it('carries the null through to the domain input, where the merge deletes the key', () => {
        // Arrange
        const body = AccommodationUpdateHttpSchema.partial()
            .strict()
            .parse({ policies: { minNights: null, maxNights: 7 } });

        // Act
        const domain = httpToDomainAccommodationUpdate(body);

        // Assert
        expect(domain.policies).toEqual({ minNights: null, maxNights: 7 });
        expect(AccommodationUpdateInputSchema.safeParse(domain).success).toBe(true);
    });
});
