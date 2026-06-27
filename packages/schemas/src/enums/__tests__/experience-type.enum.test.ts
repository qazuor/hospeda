import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExperienceTypeEnum } from '../experience-type.enum.js';
import { ExperienceTypeEnumSchema } from '../experience-type.schema.js';

// ============================================================================
// ExperienceTypeEnum — SPEC-240 (14 values for tourism services & experiences)
// ============================================================================

describe('ExperienceTypeEnum', () => {
    it('should have exactly 14 values', () => {
        // Arrange
        const values = Object.values(ExperienceTypeEnum);

        // Assert
        expect(values).toHaveLength(14);
    });

    describe('all 14 values', () => {
        it('should include CAR_RENTAL', () => {
            expect(ExperienceTypeEnum.CAR_RENTAL).toBe('CAR_RENTAL');
        });

        it('should include BIKE_RENTAL', () => {
            expect(ExperienceTypeEnum.BIKE_RENTAL).toBe('BIKE_RENTAL');
        });

        it('should include KAYAK_RENTAL', () => {
            expect(ExperienceTypeEnum.KAYAK_RENTAL).toBe('KAYAK_RENTAL');
        });

        it('should include QUAD_RENTAL', () => {
            expect(ExperienceTypeEnum.QUAD_RENTAL).toBe('QUAD_RENTAL');
        });

        it('should include TOUR_GUIDE', () => {
            expect(ExperienceTypeEnum.TOUR_GUIDE).toBe('TOUR_GUIDE');
        });

        it('should include GUIDED_VISIT', () => {
            expect(ExperienceTypeEnum.GUIDED_VISIT).toBe('GUIDED_VISIT');
        });

        it('should include EXCURSION', () => {
            expect(ExperienceTypeEnum.EXCURSION).toBe('EXCURSION');
        });

        it('should include BOAT_TRIP', () => {
            expect(ExperienceTypeEnum.BOAT_TRIP).toBe('BOAT_TRIP');
        });

        it('should include FISHING_CHARTER', () => {
            expect(ExperienceTypeEnum.FISHING_CHARTER).toBe('FISHING_CHARTER');
        });

        it('should include BIRD_WATCHING', () => {
            expect(ExperienceTypeEnum.BIRD_WATCHING).toBe('BIRD_WATCHING');
        });

        it('should include CULTURAL_TOUR', () => {
            expect(ExperienceTypeEnum.CULTURAL_TOUR).toBe('CULTURAL_TOUR');
        });

        it('should include WINE_TASTING', () => {
            expect(ExperienceTypeEnum.WINE_TASTING).toBe('WINE_TASTING');
        });

        it('should include OUTDOOR_ADVENTURE', () => {
            expect(ExperienceTypeEnum.OUTDOOR_ADVENTURE).toBe('OUTDOOR_ADVENTURE');
        });

        it('should include OTHER', () => {
            expect(ExperienceTypeEnum.OTHER).toBe('OTHER');
        });
    });

    describe('ExperienceTypeEnumSchema', () => {
        it('should accept all 14 values', () => {
            for (const value of Object.values(ExperienceTypeEnum)) {
                const result = ExperienceTypeEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should accept CAR_RENTAL', () => {
            const result = ExperienceTypeEnumSchema.safeParse('CAR_RENTAL');
            expect(result.success).toBe(true);
        });

        it('should accept EXCURSION', () => {
            const result = ExperienceTypeEnumSchema.safeParse('EXCURSION');
            expect(result.success).toBe(true);
        });

        it('should accept OTHER (catch-all)', () => {
            const result = ExperienceTypeEnumSchema.safeParse('OTHER');
            expect(result.success).toBe(true);
        });

        it('should reject an unknown type with ZodError', () => {
            // Arrange / Act
            const result = ExperienceTypeEnumSchema.safeParse('SCUBA_DIVING');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            const result = ExperienceTypeEnumSchema.safeParse('car_rental');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = ExperienceTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = ExperienceTypeEnumSchema.parse('BOAT_TRIP');

            // Assert
            expect(parsed).toBe(ExperienceTypeEnum.BOAT_TRIP);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => ExperienceTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
