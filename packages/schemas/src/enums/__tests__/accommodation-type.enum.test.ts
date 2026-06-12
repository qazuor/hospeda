import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AccommodationTypeEnum } from '../accommodation-type.enum.js';
import { AccommodationTypeEnumSchema } from '../accommodation-type.schema.js';

// ============================================================================
// AccommodationTypeEnum — extended in SPEC-213 with APART_HOTEL, ESTANCIA,
// BED_AND_BREAKFAST (total: 13 values)
// ============================================================================

describe('AccommodationTypeEnum', () => {
    it('should have exactly 13 values (10 original + 3 new from SPEC-213)', () => {
        // Arrange
        const values = Object.values(AccommodationTypeEnum);

        // Assert
        expect(values).toHaveLength(13);
    });

    describe('original 10 values', () => {
        it('should preserve APARTMENT', () => {
            expect(AccommodationTypeEnum.APARTMENT).toBe('APARTMENT');
        });

        it('should preserve HOUSE', () => {
            expect(AccommodationTypeEnum.HOUSE).toBe('HOUSE');
        });

        it('should preserve COUNTRY_HOUSE', () => {
            expect(AccommodationTypeEnum.COUNTRY_HOUSE).toBe('COUNTRY_HOUSE');
        });

        it('should preserve CABIN', () => {
            expect(AccommodationTypeEnum.CABIN).toBe('CABIN');
        });

        it('should preserve HOTEL', () => {
            expect(AccommodationTypeEnum.HOTEL).toBe('HOTEL');
        });

        it('should preserve HOSTEL', () => {
            expect(AccommodationTypeEnum.HOSTEL).toBe('HOSTEL');
        });

        it('should preserve CAMPING', () => {
            expect(AccommodationTypeEnum.CAMPING).toBe('CAMPING');
        });

        it('should preserve ROOM', () => {
            expect(AccommodationTypeEnum.ROOM).toBe('ROOM');
        });

        it('should preserve MOTEL', () => {
            expect(AccommodationTypeEnum.MOTEL).toBe('MOTEL');
        });

        it('should preserve RESORT', () => {
            expect(AccommodationTypeEnum.RESORT).toBe('RESORT');
        });
    });

    describe('3 new values added in SPEC-213', () => {
        it('should include APART_HOTEL', () => {
            expect(AccommodationTypeEnum.APART_HOTEL).toBe('APART_HOTEL');
        });

        it('should include ESTANCIA', () => {
            expect(AccommodationTypeEnum.ESTANCIA).toBe('ESTANCIA');
        });

        it('should include BED_AND_BREAKFAST', () => {
            expect(AccommodationTypeEnum.BED_AND_BREAKFAST).toBe('BED_AND_BREAKFAST');
        });
    });

    describe('AccommodationTypeEnumSchema', () => {
        it('should accept all 13 values', () => {
            for (const value of Object.values(AccommodationTypeEnum)) {
                const result = AccommodationTypeEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should accept APART_HOTEL', () => {
            const result = AccommodationTypeEnumSchema.safeParse('APART_HOTEL');
            expect(result.success).toBe(true);
        });

        it('should accept ESTANCIA', () => {
            const result = AccommodationTypeEnumSchema.safeParse('ESTANCIA');
            expect(result.success).toBe(true);
        });

        it('should accept BED_AND_BREAKFAST', () => {
            const result = AccommodationTypeEnumSchema.safeParse('BED_AND_BREAKFAST');
            expect(result.success).toBe(true);
        });

        it('should reject an unknown type with ZodError', () => {
            // Arrange / Act
            const result = AccommodationTypeEnumSchema.safeParse('VILLA');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            const result = AccommodationTypeEnumSchema.safeParse('apart_hotel');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = AccommodationTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = AccommodationTypeEnumSchema.parse('BED_AND_BREAKFAST');

            // Assert
            expect(parsed).toBe(AccommodationTypeEnum.BED_AND_BREAKFAST);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => AccommodationTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
