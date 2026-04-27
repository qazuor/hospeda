import { describe, expect, it } from 'vitest';
import {
    AccommodationLocationFields,
    AccommodationLocationSchema
} from '../../../src/entities/accommodation/accommodation.location.schema';

/**
 * Test suite for AccommodationLocationSchema (SPEC-095).
 *
 * Verifies that the schema only carries postal-address fields and explicitly
 * excludes geographic context (city, state, country, etc.) which now lives in
 * the destination relation.
 */
describe('AccommodationLocationSchema', () => {
    it('parses an empty object (all fields optional)', () => {
        const result = AccommodationLocationSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('parses a valid postal address', () => {
        const input = {
            coordinates: { lat: '-32.4847', long: '-58.2322' },
            street: 'Av. Mitre',
            number: '1234',
            floor: '2',
            apartment: 'B'
        };
        const result = AccommodationLocationSchema.safeParse(input);
        expect(result.success).toBe(true);
    });

    it('strips unknown geographic keys (city, state, country) on parse', () => {
        const input = {
            street: 'Av. Mitre',
            number: '1234',
            city: 'Concepción del Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            zipCode: '3260'
        };
        const result = AccommodationLocationSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('city');
            expect(result.data).not.toHaveProperty('state');
            expect(result.data).not.toHaveProperty('country');
            expect(result.data).not.toHaveProperty('zipCode');
        }
    });

    it('rejects too-short street', () => {
        const result = AccommodationLocationSchema.safeParse({ street: 'A' });
        expect(result.success).toBe(false);
    });

    it('rejects too-long apartment', () => {
        const result = AccommodationLocationSchema.safeParse({ apartment: 'X'.repeat(11) });
        expect(result.success).toBe(false);
    });

    it('exposes the schema shape with only postal-address keys', () => {
        const shape = AccommodationLocationSchema.shape;
        expect(Object.keys(shape).sort()).toEqual([
            'apartment',
            'coordinates',
            'floor',
            'number',
            'street'
        ]);
    });

    it('AccommodationLocationFields wraps the schema as optional', () => {
        const result = AccommodationLocationFields.location.safeParse(undefined);
        expect(result.success).toBe(true);
    });
});
