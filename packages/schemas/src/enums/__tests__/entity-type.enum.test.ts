import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EntityTypeEnum } from '../entity-type.enum.js';
import { EntityTypeEnumSchema } from '../entity-type.schema.js';

// ============================================================================
// EntityTypeEnum — expanded in SPEC-086 (tag system refactor)
// ============================================================================

describe('EntityTypeEnum', () => {
    it('should have exactly 12 values (5 original + 4 from SPEC-086 + 2 from F3 favorites + 1 from HOS-981)', () => {
        // Arrange
        const values = Object.values(EntityTypeEnum);

        // Assert (AC-F15; F3 appended EXPERIENCE + GASTRONOMY for user bookmarks,
        // HOS-981 appended HOST_TRADE for qr_codes.entity_type)
        expect(values).toHaveLength(12);
    });

    describe('original 5 values', () => {
        it('should preserve ACCOMMODATION', () => {
            expect(EntityTypeEnum.ACCOMMODATION).toBe('ACCOMMODATION');
        });

        it('should preserve DESTINATION', () => {
            expect(EntityTypeEnum.DESTINATION).toBe('DESTINATION');
        });

        it('should preserve USER', () => {
            expect(EntityTypeEnum.USER).toBe('USER');
        });

        it('should preserve POST (D-019: valid for r_entity_tag user-tag assignments)', () => {
            expect(EntityTypeEnum.POST).toBe('POST');
        });

        it('should preserve EVENT', () => {
            expect(EntityTypeEnum.EVENT).toBe('EVENT');
        });
    });

    describe('4 new values added in SPEC-086', () => {
        it('should include CONVERSATION', () => {
            expect(EntityTypeEnum.CONVERSATION).toBe('CONVERSATION');
        });

        it('should include REVIEW', () => {
            expect(EntityTypeEnum.REVIEW).toBe('REVIEW');
        });

        it('should include BILLING_SUBSCRIPTION', () => {
            expect(EntityTypeEnum.BILLING_SUBSCRIPTION).toBe('BILLING_SUBSCRIPTION');
        });

        it('should include PAYMENT', () => {
            expect(EntityTypeEnum.PAYMENT).toBe('PAYMENT');
        });
    });

    describe('2 new values added in F3 (favorites for experiences + gastronomy)', () => {
        it('should include EXPERIENCE', () => {
            expect(EntityTypeEnum.EXPERIENCE).toBe('EXPERIENCE');
        });

        it('should include GASTRONOMY', () => {
            expect(EntityTypeEnum.GASTRONOMY).toBe('GASTRONOMY');
        });
    });

    describe('1 new value added in HOS-981 (QR codes for providers)', () => {
        it('should include HOST_TRADE', () => {
            expect(EntityTypeEnum.HOST_TRADE).toBe('HOST_TRADE');
        });
    });

    describe('EntityTypeEnumSchema', () => {
        it('should accept every enum value', () => {
            for (const value of Object.values(EntityTypeEnum)) {
                const result = EntityTypeEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should accept BILLING_SUBSCRIPTION (AC-F15)', () => {
            // Arrange / Act
            const result = EntityTypeEnumSchema.safeParse('BILLING_SUBSCRIPTION');

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept CONVERSATION', () => {
            const result = EntityTypeEnumSchema.safeParse('CONVERSATION');
            expect(result.success).toBe(true);
        });

        it('should accept REVIEW', () => {
            const result = EntityTypeEnumSchema.safeParse('REVIEW');
            expect(result.success).toBe(true);
        });

        it('should accept PAYMENT', () => {
            const result = EntityTypeEnumSchema.safeParse('PAYMENT');
            expect(result.success).toBe(true);
        });

        it('should accept EXPERIENCE', () => {
            const result = EntityTypeEnumSchema.safeParse('EXPERIENCE');
            expect(result.success).toBe(true);
        });

        it('should accept GASTRONOMY', () => {
            const result = EntityTypeEnumSchema.safeParse('GASTRONOMY');
            expect(result.success).toBe(true);
        });

        it('should accept HOST_TRADE', () => {
            const result = EntityTypeEnumSchema.safeParse('HOST_TRADE');
            expect(result.success).toBe(true);
        });

        /**
         * The spelling matters more here than for the other values: HOS-981
         * stores this on `qr_codes.entity_type`, where a mis-spelled variant
         * would make the (entityType, entityId) lookup miss an existing code and
         * mint a second permanent slug for the same provider.
         */
        it('should reject the camelCase and snake_case spellings of HOST_TRADE', () => {
            expect(EntityTypeEnumSchema.safeParse('hostTrade').success).toBe(false);
            expect(EntityTypeEnumSchema.safeParse('host_trade').success).toBe(false);
        });

        it('should reject an unknown entity type with ZodError', () => {
            // Arrange / Act
            const result = EntityTypeEnumSchema.safeParse('INVOICE');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            const result = EntityTypeEnumSchema.safeParse('accommodation');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = EntityTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = EntityTypeEnumSchema.parse('REVIEW');

            // Assert
            expect(parsed).toBe(EntityTypeEnum.REVIEW);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => EntityTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
