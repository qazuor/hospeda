import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    VenueFiltersSchema,
    VenueSearchSchema
} from '../../../src/entities/venue/venue.query.schema.js';

describe('VenueSearchSchema', () => {
    it('should validate an empty search (all defaults)', () => {
        expect(() => VenueSearchSchema.parse({})).not.toThrow();

        const result = VenueSearchSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
    });

    it('should accept numeric page and pageSize', () => {
        const result = VenueSearchSchema.parse({ page: 2, pageSize: 25 });
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(25);
    });

    it('should accept valid search with type filter', () => {
        const data = { type: 'RESTAURANT' };
        expect(() => VenueSearchSchema.parse(data)).not.toThrow();
    });

    it('should accept multiple types array', () => {
        const data = { types: ['RESTAURANT', 'PARRILLA'] };
        expect(() => VenueSearchSchema.parse(data)).not.toThrow();
    });

    it('should accept priceRange filter', () => {
        const data = { priceRange: 'MID' };
        expect(() => VenueSearchSchema.parse(data)).not.toThrow();
    });

    it('should accept isFeatured boolean filter', () => {
        const result = VenueSearchSchema.parse({ isFeatured: true });
        expect(result.isFeatured).toBe(true);
    });

    it('should reject invalid type enum value', () => {
        expect(() => VenueSearchSchema.parse({ type: 'TAQUERIA' })).toThrow(ZodError);
    });

    it('should reject page < 1', () => {
        expect(() => VenueSearchSchema.parse({ page: 0 })).toThrow(ZodError);
    });

    it('should reject pageSize > 100', () => {
        expect(() => VenueSearchSchema.parse({ pageSize: 200 })).toThrow(ZodError);
    });
});

describe('VenueFiltersSchema', () => {
    it('should validate empty filters', () => {
        expect(() => VenueFiltersSchema.parse({})).not.toThrow();
    });

    it('should accept destinationId filter', () => {
        const data = {
            destinationId: '123e4567-e89b-12d3-a456-426614174000'
        };
        expect(() => VenueFiltersSchema.parse(data)).not.toThrow();
    });

    it('should accept isOpenNow filter', () => {
        expect(() => VenueFiltersSchema.parse({ isOpenNow: true })).not.toThrow();
    });
});
