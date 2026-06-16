import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { GastronomyOptionsItemSchema } from '../../../src/entities/gastronomy/gastronomy.options.schema.js';

describe('GastronomyOptionsItemSchema', () => {
    it('should validate a minimal options item (type and destination are required)', () => {
        // GastronomyOptionsItemSchema extends EntityOptionsItemSchema with required type+destination
        const data = {
            id: faker.string.uuid(),
            label: 'La Parrilla de Juan',
            slug: 'la-parrilla-de-juan',
            type: 'PARRILLA',
            destination: null // nullable is allowed
        };
        expect(() => GastronomyOptionsItemSchema.parse(data)).not.toThrow();
    });

    it('should validate a full options item with type and destination', () => {
        const data = {
            id: faker.string.uuid(),
            label: 'Café del Centro',
            slug: 'cafe-del-centro',
            type: 'CAFE',
            destination: {
                id: faker.string.uuid(),
                name: 'Concepción del Uruguay',
                slug: 'concepcion-del-uruguay'
            }
        };
        expect(() => GastronomyOptionsItemSchema.parse(data)).not.toThrow();
    });

    it('should reject when id is missing', () => {
        const data = { label: 'Test', slug: 'test', type: 'CAFE', destination: null };
        expect(() => GastronomyOptionsItemSchema.parse(data)).toThrow(ZodError);
    });

    it('should accept any string id (EntityOptionsItemSchema uses z.string() not z.string().uuid())', () => {
        // EntityOptionsItemSchema.id is z.string() without UUID validation
        // to allow flexibility in relation selectors.
        const data = {
            id: 'not-a-uuid',
            label: 'Test',
            slug: 'test',
            type: 'CAFE',
            destination: null
        };
        expect(() => GastronomyOptionsItemSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid type enum value', () => {
        const data = {
            id: faker.string.uuid(),
            label: 'Test',
            slug: 'test',
            type: 'PIZZERIA',
            destination: null
        };
        expect(() => GastronomyOptionsItemSchema.parse(data)).toThrow(ZodError);
    });
});
