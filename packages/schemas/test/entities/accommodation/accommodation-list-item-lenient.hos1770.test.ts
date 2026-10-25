import { describe, expect, it } from 'vitest';
import { AccommodationAdminSchema } from '../../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationLocationSchema } from '../../../src/entities/accommodation/accommodation.location.schema.js';
import { AccommodationListItemSchema } from '../../../src/entities/accommodation/accommodation.query.schema.js';
import { AccommodationSchema } from '../../../src/entities/accommodation/accommodation.schema.js';
import { AccommodationPriceSchema } from '../../../src/entities/accommodation/subtypes/accommodation.price.schema.js';
import { createValidAccommodation } from '../../fixtures/accommodation.fixtures.js';

type Payload = Record<string, unknown>;

const valid = (): Payload => ({
    ...createValidAccommodation(),
    name: 'Valid accommodation',
    price: { price: 100, currency: 'ARS' },
    location: { street: 'Valid Street', number: '10' }
});

const readCases: readonly { name: string; mutate: (base: Payload) => Payload }[] = [
    {
        name: 'base price zero',
        mutate: (base) => ({ ...base, price: { price: 0, currency: 'ARS' } })
    },
    {
        name: 'cleaning fee price zero',
        mutate: (base) => ({
            ...base,
            price: {
                price: 100,
                currency: 'ARS',
                additionalFees: { cleaning: { price: 0, currency: 'ARS' } }
            }
        })
    },
    {
        name: 'discount price zero',
        mutate: (base) => ({
            ...base,
            price: {
                price: 100,
                currency: 'ARS',
                discounts: { weekly: { price: 0, currency: 'ARS' } }
            }
        })
    },
    {
        name: 'custom fee name shorter than write minimum',
        mutate: (base) => ({
            ...base,
            price: {
                price: 100,
                currency: 'ARS',
                additionalFees: { others: [{ name: 'X', price: 10, currency: 'ARS' }] }
            }
        })
    },
    { name: 'one-character street', mutate: (base) => ({ ...base, location: { street: 'A' } }) },
    {
        name: 'street over write maximum',
        mutate: (base) => ({ ...base, location: { street: 'A'.repeat(60) } })
    },
    {
        name: 'number over write maximum',
        mutate: (base) => ({
            ...base,
            location: { street: 'Valid Street', number: '1'.repeat(11) }
        })
    },
    { name: 'two-character name', mutate: (base) => ({ ...base, name: 'AB' }) }
];

describe('TEST:1770:1 accommodation list read values match admin read tolerance', () => {
    it.each(readCases)('accepts $name in list and admin schemas', ({ mutate }) => {
        // Arrange
        const base = valid();
        expect(AccommodationListItemSchema.safeParse(base).success).toBe(true);
        expect(AccommodationAdminSchema.safeParse(base).success).toBe(true);
        const historical = mutate(base);

        // Act
        const listResult = AccommodationListItemSchema.safeParse(historical);
        const adminResult = AccommodationAdminSchema.safeParse(historical);

        // Assert
        expect(listResult.success).toBe(true);
        expect(adminResult.success).toBe(true);
    });
});

describe('TEST:1770:2 accommodation list preserves admin strict fields', () => {
    it.each([
        [
            'invalid coordinate',
            (base: Payload) => ({
                ...base,
                location: { street: 'Valid Street', coordinates: { lat: 'abc', lng: 1 } }
            })
        ],
        [
            'invalid currency',
            (base: Payload) => ({ ...base, price: { price: 100, currency: 'XXX' } })
        ],
        [
            'wrong price type',
            (base: Payload) => ({ ...base, price: { price: 'cien', currency: 'ARS' } })
        ]
    ])('rejects %s', (_name, mutate) => {
        // Arrange
        const base = valid();
        expect(AccommodationAdminSchema.safeParse(base).success).toBe(true);

        // Act
        const result = AccommodationListItemSchema.safeParse(mutate(base));

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('TEST:1770:3 accommodation input minimums are unchanged', () => {
    it.each([
        [
            'AccommodationSchema name',
            AccommodationSchema,
            (base: Payload) => ({ ...base, name: 'AB' })
        ],
        [
            'AccommodationLocationSchema street',
            AccommodationLocationSchema,
            (base: Payload) => ({ street: 'A' })
        ],
        [
            'AccommodationPriceSchema price',
            AccommodationPriceSchema,
            (base: Payload) => ({ ...base, price: 0, currency: 'ARS' })
        ]
    ])('rejects %s after accepting its valid base', (_name, schema, mutate) => {
        // Arrange
        const base = _name.includes('Location')
            ? { street: 'Valid Street' }
            : _name.includes('Price')
              ? { price: 100, currency: 'ARS' }
              : valid();
        expect(schema.safeParse(base).success).toBe(true);

        // Act
        const result = schema.safeParse(mutate(base));

        // Assert
        expect(result.success).toBe(false);
    });
});
