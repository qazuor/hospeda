import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { ProfessionalServiceCategoryEnum } from '../../src/enums/professional-service-category.enum';
import { ProfessionalServiceCategorySchema } from '../../src/enums/professional-service-category.schema';

describe('ProfessionalServiceCategoryEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(ProfessionalServiceCategoryEnum.PHOTO).toBe('PHOTO');
            expect(ProfessionalServiceCategoryEnum.COPYWRITING).toBe('COPYWRITING');
            expect(ProfessionalServiceCategoryEnum.SEO).toBe('SEO');
            expect(ProfessionalServiceCategoryEnum.DESIGN).toBe('DESIGN');
            expect(ProfessionalServiceCategoryEnum.MAINTENANCE).toBe('MAINTENANCE');
            expect(ProfessionalServiceCategoryEnum.TOUR).toBe('TOUR');
            expect(ProfessionalServiceCategoryEnum.BIKE_RENTAL).toBe('BIKE_RENTAL');
            expect(ProfessionalServiceCategoryEnum.OTHER).toBe('OTHER');
        });

        it('should have exactly 8 values', () => {
            const values = Object.values(ProfessionalServiceCategoryEnum);
            expect(values).toHaveLength(8);
        });

        it('should contain all expected values', () => {
            const values = Object.values(ProfessionalServiceCategoryEnum);
            expect(values).toEqual(
                expect.arrayContaining([
                    'PHOTO',
                    'COPYWRITING',
                    'SEO',
                    'DESIGN',
                    'MAINTENANCE',
                    'TOUR',
                    'BIKE_RENTAL',
                    'OTHER'
                ])
            );
        });
    });

    describe('ProfessionalServiceCategorySchema validation', () => {
        it('should validate correct enum values', () => {
            expect(ProfessionalServiceCategorySchema.parse('PHOTO')).toBe('PHOTO');
            expect(ProfessionalServiceCategorySchema.parse('COPYWRITING')).toBe('COPYWRITING');
            expect(ProfessionalServiceCategorySchema.parse('SEO')).toBe('SEO');
            expect(ProfessionalServiceCategorySchema.parse('DESIGN')).toBe('DESIGN');
            expect(ProfessionalServiceCategorySchema.parse('MAINTENANCE')).toBe('MAINTENANCE');
            expect(ProfessionalServiceCategorySchema.parse('TOUR')).toBe('TOUR');
            expect(ProfessionalServiceCategorySchema.parse('BIKE_RENTAL')).toBe('BIKE_RENTAL');
            expect(ProfessionalServiceCategorySchema.parse('OTHER')).toBe('OTHER');
        });

        it('should reject invalid values', () => {
            expect(() => ProfessionalServiceCategorySchema.parse('INVALID')).toThrow();
            expect(() => ProfessionalServiceCategorySchema.parse('')).toThrow();
            expect(() => ProfessionalServiceCategorySchema.parse(null)).toThrow();
            expect(() => ProfessionalServiceCategorySchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                ProfessionalServiceCategorySchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe(
                    'zodError.enums.professionalServiceCategory.invalid'
                );
            }
        });
    });
});
