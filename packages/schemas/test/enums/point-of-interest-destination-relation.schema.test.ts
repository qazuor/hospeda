import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PointOfInterestDestinationRelationEnum } from '../../src/enums/point-of-interest-destination-relation.enum.js';
import { PointOfInterestDestinationRelationEnumSchema } from '../../src/enums/point-of-interest-destination-relation.schema.js';

// ============================================================================
// PointOfInterestDestinationRelationEnum — HOS-140
// 2 values: PRIMARY (POI physically in the destination), NEARBY
//           (cross-referenced from a different destination's page)
// ============================================================================

describe('PointOfInterestDestinationRelationEnum', () => {
    describe('enum values', () => {
        it('should define PRIMARY', () => {
            expect(PointOfInterestDestinationRelationEnum.PRIMARY).toBe('PRIMARY');
        });

        it('should define NEARBY', () => {
            expect(PointOfInterestDestinationRelationEnum.NEARBY).toBe('NEARBY');
        });

        it('should have exactly 2 values', () => {
            expect(Object.values(PointOfInterestDestinationRelationEnum)).toHaveLength(2);
        });
    });

    describe('PointOfInterestDestinationRelationEnumSchema', () => {
        it('should accept all 2 defined values', () => {
            const values = Object.values(PointOfInterestDestinationRelationEnum);
            for (const value of values) {
                expect(PointOfInterestDestinationRelationEnumSchema.safeParse(value).success).toBe(
                    true
                );
            }
        });

        it('should reject an unknown relation kind with ZodError', () => {
            const result = PointOfInterestDestinationRelationEnumSchema.safeParse('ALL');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variant', () => {
            const result = PointOfInterestDestinationRelationEnumSchema.safeParse('primary');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = PointOfInterestDestinationRelationEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should use the invalid message key on rejection', () => {
            const result = PointOfInterestDestinationRelationEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.pointOfInterestDestinationRelation.invalid'
                );
            }
        });

        it('should return the enum member when parsing a valid value', () => {
            const parsed = PointOfInterestDestinationRelationEnumSchema.parse('NEARBY');
            expect(parsed).toBe(PointOfInterestDestinationRelationEnum.NEARBY);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() =>
                PointOfInterestDestinationRelationEnumSchema.parse('INVALID')
            ).toThrowError(ZodError);
        });
    });
});
