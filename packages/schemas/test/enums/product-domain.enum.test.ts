import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ProductDomainEnum } from '../../src/enums/product-domain.enum.js';
import { ProductDomainEnumSchema } from '../../src/enums/product-domain.schema.js';

// ============================================================================
// ProductDomainEnum — SPEC-239 T-001
// ============================================================================

describe('ProductDomainEnum', () => {
    describe('enum values', () => {
        it('should define ACCOMMODATION', () => {
            expect(ProductDomainEnum.ACCOMMODATION).toBe('accommodation');
        });

        it('should define PARTNER', () => {
            expect(ProductDomainEnum.PARTNER).toBe('partner');
        });

        it('should define GASTRONOMY', () => {
            expect(ProductDomainEnum.GASTRONOMY).toBe('gastronomy');
        });

        it('should define EXPERIENCE', () => {
            expect(ProductDomainEnum.EXPERIENCE).toBe('experience');
        });

        // HOS-685 — this count is a frozen baseline, not a formality. Nothing in
        // the type system reacts to a member appearing or disappearing (no
        // `Record<ProductDomainEnum, …>`, no exhaustive `switch`, no `satisfies`),
        // so this assertion is the only thing that fails when the vocabulary
        // changes without the call sites being reviewed.
        //
        // HOS-695 (release C) retired COMMERCE, dropping the count from 5 to 4 —
        // the last of the three releases (A widened it, B rewrote every row off
        // it, C removes the member itself).
        it('should have exactly 4 values', () => {
            expect(Object.values(ProductDomainEnum)).toHaveLength(4);
        });

        it('should NOT define COMMERCE (HOS-695 — retired)', () => {
            expect(ProductDomainEnum).not.toHaveProperty('COMMERCE');
        });
    });

    describe('ProductDomainEnumSchema', () => {
        it('should accept "accommodation"', () => {
            // Arrange / Act
            const result = ProductDomainEnumSchema.safeParse('accommodation');
            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject the retired "commerce" value (HOS-695)', () => {
            const result = ProductDomainEnumSchema.safeParse('commerce');
            expect(result.success).toBe(false);
        });

        it('should accept "partner"', () => {
            const result = ProductDomainEnumSchema.safeParse('partner');
            expect(result.success).toBe(true);
        });

        it('should accept "gastronomy"', () => {
            const result = ProductDomainEnumSchema.safeParse('gastronomy');
            expect(result.success).toBe(true);
        });

        it('should accept "experience"', () => {
            const result = ProductDomainEnumSchema.safeParse('experience');
            expect(result.success).toBe(true);
        });

        it('should accept all defined values', () => {
            // Arrange
            const values = Object.values(ProductDomainEnum);
            // Act / Assert
            for (const value of values) {
                expect(ProductDomainEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown domain with ZodError', () => {
            // Arrange / Act
            const result = ProductDomainEnumSchema.safeParse('events');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject uppercase variant', () => {
            const result = ProductDomainEnumSchema.safeParse('ACCOMMODATION');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = ProductDomainEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = ProductDomainEnumSchema.parse('partner');
            // Assert
            expect(parsed).toBe(ProductDomainEnum.PARTNER);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => ProductDomainEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
