import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PointOfInterestTypeEnum } from '../../src/enums/point-of-interest-type.enum.js';
import { PointOfInterestTypeEnumSchema } from '../../src/enums/point-of-interest-type.schema.js';

// ============================================================================
// PointOfInterestTypeEnum — HOS-113 T-001 (OQ-3: closed enum taxonomy)
// 9 values: BEACH, STADIUM, PARK, MUSEUM, PLAZA, MONUMENT, VIEWPOINT,
//           NATURAL, OTHER
// ============================================================================

describe('PointOfInterestTypeEnum', () => {
    describe('enum values', () => {
        it('should define BEACH', () => {
            expect(PointOfInterestTypeEnum.BEACH).toBe('BEACH');
        });

        it('should define STADIUM', () => {
            expect(PointOfInterestTypeEnum.STADIUM).toBe('STADIUM');
        });

        it('should define PARK', () => {
            expect(PointOfInterestTypeEnum.PARK).toBe('PARK');
        });

        it('should define MUSEUM', () => {
            expect(PointOfInterestTypeEnum.MUSEUM).toBe('MUSEUM');
        });

        it('should define PLAZA', () => {
            expect(PointOfInterestTypeEnum.PLAZA).toBe('PLAZA');
        });

        it('should define MONUMENT', () => {
            expect(PointOfInterestTypeEnum.MONUMENT).toBe('MONUMENT');
        });

        it('should define VIEWPOINT', () => {
            expect(PointOfInterestTypeEnum.VIEWPOINT).toBe('VIEWPOINT');
        });

        it('should define NATURAL', () => {
            expect(PointOfInterestTypeEnum.NATURAL).toBe('NATURAL');
        });

        it('should define OTHER', () => {
            expect(PointOfInterestTypeEnum.OTHER).toBe('OTHER');
        });

        it('should have exactly 9 values', () => {
            expect(Object.values(PointOfInterestTypeEnum)).toHaveLength(9);
        });
    });

    describe('PointOfInterestTypeEnumSchema', () => {
        it('should accept all 9 defined values', () => {
            // Arrange
            const values = Object.values(PointOfInterestTypeEnum);
            // Act / Assert
            for (const value of values) {
                expect(PointOfInterestTypeEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should accept BEACH', () => {
            expect(PointOfInterestTypeEnumSchema.safeParse('BEACH').success).toBe(true);
        });

        it('should accept OTHER', () => {
            expect(PointOfInterestTypeEnumSchema.safeParse('OTHER').success).toBe(true);
        });

        it('should reject an unknown type with ZodError', () => {
            // Arrange / Act
            const result = PointOfInterestTypeEnumSchema.safeParse('WATERFALL');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variant', () => {
            const result = PointOfInterestTypeEnumSchema.safeParse('beach');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = PointOfInterestTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should use the invalid message key on rejection', () => {
            const result = PointOfInterestTypeEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.pointOfInterestType.invalid'
                );
            }
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = PointOfInterestTypeEnumSchema.parse('MONUMENT');
            // Assert
            expect(parsed).toBe(PointOfInterestTypeEnum.MONUMENT);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => PointOfInterestTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
