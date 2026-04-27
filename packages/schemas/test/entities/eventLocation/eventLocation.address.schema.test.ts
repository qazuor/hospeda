import { describe, expect, it } from 'vitest';
import { EventLocationAddressSchema } from '../../../src/entities/eventLocation/eventLocation.address.schema';

/**
 * Test suite for EventLocationAddressSchema (SPEC-095).
 *
 * Verifies the shape carries postal-address fields, placeName, and a required
 * destinationId FK — but no geographic context fields.
 */
describe('EventLocationAddressSchema', () => {
    const VALID_DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

    it('parses a minimal payload with only destinationId', () => {
        const result = EventLocationAddressSchema.safeParse({
            destinationId: VALID_DESTINATION_ID
        });
        expect(result.success).toBe(true);
    });

    it('parses a full valid address', () => {
        const input = {
            destinationId: VALID_DESTINATION_ID,
            coordinates: { lat: '-32.4847', long: '-58.2322' },
            street: 'Av. Mitre',
            number: '1234',
            floor: '2',
            apartment: 'B',
            placeName: 'Teatro Municipal'
        };
        const result = EventLocationAddressSchema.safeParse(input);
        expect(result.success).toBe(true);
    });

    it('rejects when destinationId is missing', () => {
        const result = EventLocationAddressSchema.safeParse({ placeName: 'Teatro' });
        expect(result.success).toBe(false);
    });

    it('strips unknown geographic keys (city, state, country) on parse', () => {
        const input = {
            destinationId: VALID_DESTINATION_ID,
            placeName: 'Teatro Municipal',
            city: 'Concepción del Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            zipCode: '3260',
            neighborhood: 'Centro',
            department: 'Uruguay'
        };
        const result = EventLocationAddressSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('city');
            expect(result.data).not.toHaveProperty('state');
            expect(result.data).not.toHaveProperty('country');
            expect(result.data).not.toHaveProperty('zipCode');
            expect(result.data).not.toHaveProperty('neighborhood');
            expect(result.data).not.toHaveProperty('department');
        }
    });

    it('rejects too-short placeName', () => {
        const result = EventLocationAddressSchema.safeParse({
            destinationId: VALID_DESTINATION_ID,
            placeName: 'X'
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid destinationId (not a UUID)', () => {
        const result = EventLocationAddressSchema.safeParse({ destinationId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('exposes the schema shape with only address keys plus destinationId', () => {
        const shape = EventLocationAddressSchema.shape;
        expect(Object.keys(shape).sort()).toEqual([
            'apartment',
            'coordinates',
            'destinationId',
            'floor',
            'number',
            'placeName',
            'street'
        ]);
    });
});
