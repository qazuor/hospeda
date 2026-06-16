import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { GastronomySchema } from '../../../src/entities/gastronomy/gastronomy.schema.js';
import {
    createInvalidGastronomy,
    createMinimalGastronomy,
    createValidGastronomy
} from '../../fixtures/gastronomy.fixtures.js';

describe('GastronomySchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid gastronomy listing', () => {
            const data = createValidGastronomy();
            expect(() => GastronomySchema.parse(data)).not.toThrow();

            const result = GastronomySchema.parse(data);
            expect(result.id).toBe(data.id);
            expect(result.name).toBe(data.name);
            expect(result.type).toBe(data.type);
        });

        it('should validate minimal required gastronomy data', () => {
            const data = createMinimalGastronomy();
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should default isFeatured to false when not provided', () => {
            const data = createMinimalGastronomy();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { isFeatured: _removed, ...withoutFeatured } = data as any;
            const result = GastronomySchema.parse(withoutFeatured);
            expect(result.isFeatured).toBe(false);
        });

        it('should accept nullish priceRange', () => {
            const data = { ...createMinimalGastronomy(), priceRange: null };
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should accept a valid HTTPS menuUrl', () => {
            const data = { ...createMinimalGastronomy(), menuUrl: 'https://example.com/menu' };
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should accept all valid GastronomyTypeEnum values', () => {
            const types = [
                'RESTAURANT',
                'BAR',
                'CAFE',
                'PARRILLA',
                'CERVECERIA',
                'HELADERIA',
                'PANADERIA',
                'ROTISERIA',
                'FOOD_TRUCK'
            ];
            for (const type of types) {
                const data = { ...createMinimalGastronomy(), type };
                expect(
                    () => GastronomySchema.parse(data),
                    `should accept type ${type}`
                ).not.toThrow();
            }
        });

        it('should accept all valid PriceRangeEnum values', () => {
            for (const pr of ['BUDGET', 'MID', 'HIGH', 'PREMIUM']) {
                const data = { ...createMinimalGastronomy(), priceRange: pr };
                expect(() => GastronomySchema.parse(data), `should accept ${pr}`).not.toThrow();
            }
        });
    });

    describe('Invalid Data', () => {
        it('should reject gastronomy with invalid data', () => {
            const data = createInvalidGastronomy();
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject when type is missing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { type: _t, ...data } = createMinimalGastronomy() as any;
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject when destinationId is missing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { destinationId: _d, ...data } = createMinimalGastronomy() as any;
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject non-HTTPS menuUrl', () => {
            const data = { ...createMinimalGastronomy(), menuUrl: 'http://insecure.com/menu' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject an invalid type value (enum validation on entity schema)', () => {
            // GastronomySchema.type is GastronomyTypeEnumSchema — invalid values are rejected.
            const data = { ...createMinimalGastronomy(), type: 'PIZZERIA' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject invalid id format', () => {
            const data = { ...createMinimalGastronomy(), id: 'not-a-uuid' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject name shorter than 2 characters', () => {
            const data = { ...createMinimalGastronomy(), name: 'A' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject summary shorter than 10 characters', () => {
            const data = { ...createMinimalGastronomy(), summary: 'Too short' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject description shorter than 20 characters', () => {
            const data = { ...createMinimalGastronomy(), description: 'Too short' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });
    });
});
