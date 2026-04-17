import { describe, expect, it } from 'vitest';
import {
    OwnerPromotionCreateInputSchema,
    OwnerPromotionCreateOutputSchema,
    OwnerPromotionDeleteInputSchema,
    OwnerPromotionDeleteOutputSchema,
    OwnerPromotionRestoreInputSchema,
    OwnerPromotionRestoreOutputSchema,
    OwnerPromotionUpdateInputSchema,
    OwnerPromotionUpdateOutputSchema
} from '../../../src/entities/ownerPromotion/index.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';
import { OwnerPromotionDiscountTypeEnum } from '../../../src/enums/owner-promotion-discount-type.enum.js';
import {
    createMinimalOwnerPromotion,
    createOwnerPromotionCreateInput,
    createOwnerPromotionUpdateInput,
    createValidOwnerPromotion
} from '../../fixtures/ownerPromotion.fixtures.js';

describe('OwnerPromotion CRUD Schemas', () => {
    describe('OwnerPromotionCreateInputSchema', () => {
        it('should validate valid create input', () => {
            // Arrange
            const input = createOwnerPromotionCreateInput();

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should require ownerId', () => {
            // Arrange
            const { ownerId: _omitted, ...input } = createOwnerPromotionCreateInput();

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should require title', () => {
            // Arrange
            const { title: _omitted, ...input } = createOwnerPromotionCreateInput();

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should require discountType', () => {
            // Arrange
            const { discountType: _omitted, ...input } = createOwnerPromotionCreateInput();

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should require discountValue', () => {
            // Arrange
            const { discountValue: _omitted, ...input } = createOwnerPromotionCreateInput();

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should require validFrom', () => {
            // Arrange
            const { validFrom: _omitted, ...input } = createOwnerPromotionCreateInput();

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject auto-generated field: id', () => {
            // Arrange
            const input = {
                ...createOwnerPromotionCreateInput(),
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            // Act — use strict() to detect extra fields
            const result = OwnerPromotionCreateInputSchema.strict().safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject auto-generated field: createdAt', () => {
            // Arrange
            const input = { ...createOwnerPromotionCreateInput(), createdAt: new Date() };

            // Act
            const result = OwnerPromotionCreateInputSchema.strict().safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject auto-generated field: currentRedemptions', () => {
            // Arrange
            const input = { ...createOwnerPromotionCreateInput(), currentRedemptions: 0 };

            // Act
            const result = OwnerPromotionCreateInputSchema.strict().safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should allow slug to be omitted (auto-generated)', () => {
            // Arrange
            const input = {
                ownerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                title: 'Summer Discount',
                discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                discountValue: 15,
                validFrom: new Date('2024-07-01')
            };

            // Act
            const result = OwnerPromotionCreateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate all discount type enum values', () => {
            // Arrange & Act & Assert
            for (const discountType of Object.values(OwnerPromotionDiscountTypeEnum)) {
                const input = { ...createOwnerPromotionCreateInput(), discountType };
                const result = OwnerPromotionCreateInputSchema.safeParse(input);
                expect(result.success, `discountType "${discountType}" should be valid`).toBe(true);
            }
        });
    });

    describe('OwnerPromotionCreateOutputSchema', () => {
        it('should validate a complete promotion as create output', () => {
            // Arrange
            const output = createValidOwnerPromotion();

            // Act
            const result = OwnerPromotionCreateOutputSchema.safeParse(output);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject incomplete output missing required fields', () => {
            // Arrange
            const incomplete = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', title: 'Promo' };

            // Act
            const result = OwnerPromotionCreateOutputSchema.safeParse(incomplete);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('OwnerPromotionUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            // Arrange
            const input = createOwnerPromotionUpdateInput();

            // Act
            const result = OwnerPromotionUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept an empty object (all fields optional)', () => {
            // Arrange & Act
            const result = OwnerPromotionUpdateInputSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept partial update with only title', () => {
            // Arrange
            const input = { title: 'Updated Promotion Title' };

            // Act
            const result = OwnerPromotionUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept partial update with only lifecycleState', () => {
            // Arrange
            const input = { lifecycleState: LifecycleStatusEnum.ARCHIVED };

            // Act
            const result = OwnerPromotionUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject legacy isActive field in update (strict mode, AC-002-02)', () => {
            // Arrange — isActive is no longer part of the schema; strict() detects it as unknown
            const input = { isActive: false };

            // Act
            const result = OwnerPromotionUpdateInputSchema.strict().safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept partial update with only discountValue', () => {
            // Arrange
            const input = { discountValue: 30 };

            // Act
            const result = OwnerPromotionUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject invalid field values in partial update', () => {
            // Arrange — title is empty, which violates min(1)
            const input = { title: '' };

            // Act
            const result = OwnerPromotionUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid discountType in partial update', () => {
            // Arrange
            const input = { discountType: 'INVALID_TYPE' };

            // Act
            const result = OwnerPromotionUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('OwnerPromotionUpdateOutputSchema', () => {
        it('should validate a complete promotion as update output', () => {
            // Arrange
            const output = createValidOwnerPromotion();

            // Act
            const result = OwnerPromotionUpdateOutputSchema.safeParse(output);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('OwnerPromotionDeleteInputSchema', () => {
        it('should validate valid delete input with id only', () => {
            // Arrange
            const input = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = OwnerPromotionDeleteInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate delete input with force flag', () => {
            // Arrange
            const input = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', force: true };

            // Act
            const result = OwnerPromotionDeleteInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default force to false', () => {
            // Arrange
            const input = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = OwnerPromotionDeleteInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.force).toBe(false);
            }
        });

        it('should reject invalid id (not a UUID)', () => {
            // Arrange
            const input = { id: 'not-a-valid-uuid' };

            // Act
            const result = OwnerPromotionDeleteInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing id', () => {
            // Arrange
            const input = { force: false };

            // Act
            const result = OwnerPromotionDeleteInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('OwnerPromotionDeleteOutputSchema', () => {
        it('should validate valid delete output with deletedAt', () => {
            // Arrange
            const output = { success: true, deletedAt: new Date() };

            // Act
            const result = OwnerPromotionDeleteOutputSchema.safeParse(output);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate valid delete output without deletedAt', () => {
            // Arrange
            const output = { success: true };

            // Act
            const result = OwnerPromotionDeleteOutputSchema.safeParse(output);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default success to true', () => {
            // Arrange & Act
            const result = OwnerPromotionDeleteOutputSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.success).toBe(true);
            }
        });
    });

    describe('OwnerPromotionRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            // Arrange
            const input = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = OwnerPromotionRestoreInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID in restore input', () => {
            // Arrange
            const input = { id: 'not-a-uuid' };

            // Act
            const result = OwnerPromotionRestoreInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing id in restore input', () => {
            // Arrange
            const input = {};

            // Act
            const result = OwnerPromotionRestoreInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('OwnerPromotionRestoreOutputSchema', () => {
        it('should validate a complete promotion as restore output', () => {
            // Arrange
            const output = createValidOwnerPromotion();

            // Act
            const result = OwnerPromotionRestoreOutputSchema.safeParse(output);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Integration: CRUD workflow', () => {
        it('should handle a realistic create → update → delete workflow', () => {
            // Arrange
            const createInput = createOwnerPromotionCreateInput();
            const updateInput = {
                title: 'Updated Title',
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            };
            const deleteInput = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act & Assert
            expect(OwnerPromotionCreateInputSchema.safeParse(createInput).success).toBe(true);
            expect(OwnerPromotionUpdateInputSchema.safeParse(updateInput).success).toBe(true);
            expect(OwnerPromotionDeleteInputSchema.safeParse(deleteInput).success).toBe(true);

            const deleteResult = OwnerPromotionDeleteInputSchema.safeParse(deleteInput);
            if (deleteResult.success) {
                expect(deleteResult.data.force).toBe(false);
            }
        });

        it('should validate complete minimal promotion as create output', () => {
            // Arrange
            const output = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionCreateOutputSchema.safeParse(output);

            // Assert
            expect(result.success).toBe(true);
        });
    });
});
