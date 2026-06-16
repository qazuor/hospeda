import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyFiltersSchema,
    GastronomySearchSchema
} from '../../../src/entities/gastronomy/gastronomy.query.schema.js';

describe('GastronomySearchSchema', () => {
    it('should validate an empty search (all defaults)', () => {
        expect(() => GastronomySearchSchema.parse({})).not.toThrow();

        const result = GastronomySearchSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
    });

    it('should accept numeric page and pageSize', () => {
        const result = GastronomySearchSchema.parse({ page: 2, pageSize: 25 });
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(25);
    });

    it('should accept valid search with type filter', () => {
        const data = { type: 'RESTAURANT' };
        expect(() => GastronomySearchSchema.parse(data)).not.toThrow();
    });

    it('should accept multiple types array', () => {
        const data = { types: ['RESTAURANT', 'PARRILLA'] };
        expect(() => GastronomySearchSchema.parse(data)).not.toThrow();
    });

    it('should accept priceRange filter', () => {
        const data = { priceRange: 'MID' };
        expect(() => GastronomySearchSchema.parse(data)).not.toThrow();
    });

    it('should accept isFeatured boolean filter', () => {
        const result = GastronomySearchSchema.parse({ isFeatured: true });
        expect(result.isFeatured).toBe(true);
    });

    it('should reject invalid type enum value', () => {
        expect(() => GastronomySearchSchema.parse({ type: 'TAQUERIA' })).toThrow(ZodError);
    });

    it('should reject page < 1', () => {
        expect(() => GastronomySearchSchema.parse({ page: 0 })).toThrow(ZodError);
    });

    it('should reject pageSize > 100', () => {
        expect(() => GastronomySearchSchema.parse({ pageSize: 200 })).toThrow(ZodError);
    });
});

describe('GastronomyFiltersSchema', () => {
    it('should validate empty filters', () => {
        expect(() => GastronomyFiltersSchema.parse({})).not.toThrow();
    });

    it('should accept destinationId filter', () => {
        const data = {
            destinationId: '123e4567-e89b-12d3-a456-426614174000'
        };
        expect(() => GastronomyFiltersSchema.parse(data)).not.toThrow();
    });

    it('should accept isOpenNow filter', () => {
        expect(() => GastronomyFiltersSchema.parse({ isOpenNow: true })).not.toThrow();
    });
});
