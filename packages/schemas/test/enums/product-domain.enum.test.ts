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

        it('should define COMMERCE', () => {
            expect(ProductDomainEnum.COMMERCE).toBe('commerce');
        });

        it('should define PARTNER', () => {
            expect(ProductDomainEnum.PARTNER).toBe('partner');
        });

        it('should have exactly 3 values', () => {
            expect(Object.values(ProductDomainEnum)).toHaveLength(3);
        });
    });

    describe('ProductDomainEnumSchema', () => {
        it('should accept "accommodation"', () => {
            // Arrange / Act
            const result = ProductDomainEnumSchema.safeParse('accommodation');
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept "commerce"', () => {
            const result = ProductDomainEnumSchema.safeParse('commerce');
            expect(result.success).toBe(true);
        });

        it('should accept "partner"', () => {
            const result = ProductDomainEnumSchema.safeParse('partner');
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
