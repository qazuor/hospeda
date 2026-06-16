import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyCreateHttpSchema,
    GastronomySearchHttpSchema,
    GastronomyUpdateHttpSchema,
    httpToDomainGastronomyCreate,
    httpToDomainGastronomySearch,
    httpToDomainGastronomyUpdate
} from '../../../src/entities/gastronomy/gastronomy.http.schema.js';

describe('GastronomySearchHttpSchema', () => {
    it('should validate an empty search (all defaults)', () => {
        expect(() => GastronomySearchHttpSchema.parse({})).not.toThrow();
    });

    it('should coerce page from string', () => {
        const result = GastronomySearchHttpSchema.parse({ page: '2' });
        expect(result.page).toBe(2);
    });

    it('should coerce isFeatured from string "true"', () => {
        const result = GastronomySearchHttpSchema.parse({ isFeatured: 'true' });
        expect(result.isFeatured).toBe(true);
    });

    it('should coerce minRating from string', () => {
        const result = GastronomySearchHttpSchema.parse({ minRating: '4' });
        expect(result.minRating).toBe(4);
    });

    it('should reject invalid type value', () => {
        expect(() => GastronomySearchHttpSchema.parse({ type: 'TAQUERIA' })).toThrow(ZodError);
    });
});

describe('GastronomyCreateHttpSchema', () => {
    const validCreate = () => ({
        name: 'La Parrilla de Juan',
        summary: 'Parrilla tradicional argentina',
        description: 'Una parrilla tradicional con los mejores cortes de carne.',
        type: 'PARRILLA',
        destinationId: faker.string.uuid()
    });

    it('should validate a valid create payload', () => {
        expect(() => GastronomyCreateHttpSchema.parse(validCreate())).not.toThrow();
    });

    it('should default isFeatured to false', () => {
        const result = GastronomyCreateHttpSchema.parse(validCreate());
        expect(result.isFeatured).toBe(false);
    });

    it('should reject when name is missing', () => {
        const { name: _n, ...data } = validCreate();
        expect(() => GastronomyCreateHttpSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-HTTPS menuUrl', () => {
        const data = { ...validCreate(), menuUrl: 'http://insecure.com' };
        expect(() => GastronomyCreateHttpSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyUpdateHttpSchema', () => {
    it('should allow empty update', () => {
        expect(() => GastronomyUpdateHttpSchema.parse({})).not.toThrow();
    });

    it('should accept partial update with priceRange', () => {
        const data = { priceRange: 'HIGH' };
        expect(() => GastronomyUpdateHttpSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid priceRange', () => {
        expect(() => GastronomyUpdateHttpSchema.parse({ priceRange: 'EXPENSIVE' })).toThrow(
            ZodError
        );
    });
});

describe('httpToDomainGastronomySearch', () => {
    it('should convert HTTP search params to domain search input', () => {
        const httpInput = GastronomySearchHttpSchema.parse({
            type: 'RESTAURANT',
            page: '1',
            pageSize: '20'
        });
        const result = httpToDomainGastronomySearch(httpInput);
        expect(result.type).toBe('RESTAURANT');
        expect(result.page).toBe(1);
    });
});

describe('httpToDomainGastronomyCreate', () => {
    it('should convert HTTP create payload to domain create input', () => {
        const httpInput = GastronomyCreateHttpSchema.parse({
            name: 'Café del Centro',
            summary: 'Café tradicional en el centro',
            description: 'El mejor café de la ciudad con pasteles artesanales.',
            type: 'CAFE',
            destinationId: faker.string.uuid()
        });
        const result = httpToDomainGastronomyCreate(httpInput);
        expect(result.name).toBe('Café del Centro');
        expect(result.type).toBe('CAFE');
    });
});

describe('httpToDomainGastronomyUpdate', () => {
    it('should convert HTTP update payload to domain update input', () => {
        const httpInput = GastronomyUpdateHttpSchema.parse({ priceRange: 'BUDGET' });
        const result = httpToDomainGastronomyUpdate(httpInput);
        expect(result.priceRange).toBe('BUDGET');
    });
});
