import { describe, expect, it } from 'vitest';
import { OwnerPromotionSchema } from '../../../src/entities/ownerPromotion/index.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';
import { OwnerPromotionDiscountTypeEnum } from '../../../src/enums/owner-promotion-discount-type.enum.js';
import {
    createFixedPromotion,
    createFreeNightPromotion,
    createMinimalOwnerPromotion,
    createPercentagePromotion,
    createValidOwnerPromotion
} from '../../fixtures/ownerPromotion.fixtures.js';

describe('OwnerPromotionSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid owner promotion', () => {
            // Arrange
            const data = createValidOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate minimal required fields only', () => {
            // Arrange
            const data = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate a PERCENTAGE discount promotion', () => {
            // Arrange
            const data = createPercentagePromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountType).toBe(OwnerPromotionDiscountTypeEnum.PERCENTAGE);
            }
        });

        it('should validate a FIXED discount promotion', () => {
            // Arrange
            const data = createFixedPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountType).toBe(OwnerPromotionDiscountTypeEnum.FIXED);
            }
        });

        it('should validate a FREE_NIGHT discount promotion', () => {
            // Arrange
            const data = createFreeNightPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountType).toBe(OwnerPromotionDiscountTypeEnum.FREE_NIGHT);
            }
        });

        it('should accept null accommodationId (promotion applies to all accommodations)', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), accommodationId: null };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept null description', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), description: null };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept null validUntil (open-ended promotion)', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), validUntil: null };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept null minNights', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), minNights: null };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept null maxRedemptions (unlimited redemptions)', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), maxRedemptions: null };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default currentRedemptions to 0 when not provided', () => {
            // Arrange
            const { currentRedemptions: _omitted, ...data } =
                createMinimalOwnerPromotion() as ReturnType<typeof createMinimalOwnerPromotion> & {
                    currentRedemptions?: number;
                };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.currentRedemptions).toBe(0);
            }
        });

        it('should default lifecycleState to ACTIVE when not provided', () => {
            // Arrange
            const { lifecycleState: _omitted, ...data } =
                createMinimalOwnerPromotion() as ReturnType<typeof createMinimalOwnerPromotion> & {
                    lifecycleState?: LifecycleStatusEnum;
                };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
            }
        });

        it('should accept lifecycleState DRAFT', () => {
            // Arrange
            const data = {
                ...createMinimalOwnerPromotion(),
                lifecycleState: LifecycleStatusEnum.DRAFT
            };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
            }
        });

        it('should accept lifecycleState ARCHIVED', () => {
            // Arrange
            const data = {
                ...createMinimalOwnerPromotion(),
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
            }
        });

        it('should coerce string date to Date for validFrom', () => {
            // Arrange
            const data = {
                ...createMinimalOwnerPromotion(),
                validFrom: '2024-06-01T00:00:00.000Z'
            };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.validFrom).toBeInstanceOf(Date);
            }
        });

        it('should accept discountValue of exactly 0', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), discountValue: 0 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept title at maximum length boundary (200 chars)', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), title: 'T'.repeat(200) };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Invalid Data', () => {
        it('should reject missing required field: ownerId', () => {
            // Arrange
            const { ownerId: _omitted, ...data } = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing required field: title', () => {
            // Arrange
            const { title: _omitted, ...data } = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing required field: discountType', () => {
            // Arrange
            const { discountType: _omitted, ...data } = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing required field: discountValue', () => {
            // Arrange
            const { discountValue: _omitted, ...data } = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing required field: validFrom', () => {
            // Arrange
            const { validFrom: _omitted, ...data } = createMinimalOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid discountType enum value', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), discountType: 'FLAT_RATE' };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid lifecycleState enum value', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), lifecycleState: 'INVALID' };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject negative discountValue', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), discountValue: -5 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject empty slug', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), slug: '' };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject empty title', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), title: '' };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject title exceeding 200 chars', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), title: 'T'.repeat(201) };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject description exceeding 1000 chars', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), description: 'D'.repeat(1001) };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-integer minNights', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), minNights: 2.5 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject minNights less than 1', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), minNights: 0 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-integer maxRedemptions', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), maxRedemptions: 10.5 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject maxRedemptions less than 1', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), maxRedemptions: 0 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject negative currentRedemptions', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), currentRedemptions: -1 };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid ownerId (not a UUID)', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), ownerId: 'not-a-uuid' };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid accommodationId (not a UUID)', () => {
            // Arrange
            const data = { ...createMinimalOwnerPromotion(), accommodationId: 'invalid' };

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('Type Inference', () => {
        it('should infer correct field types', () => {
            // Arrange
            const data = createValidOwnerPromotion();

            // Act
            const result = OwnerPromotionSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(typeof result.data.id).toBe('string');
                expect(typeof result.data.slug).toBe('string');
                expect(typeof result.data.ownerId).toBe('string');
                expect(typeof result.data.title).toBe('string');
                expect(typeof result.data.discountType).toBe('string');
                expect(typeof result.data.discountValue).toBe('number');
                expect(typeof result.data.lifecycleState).toBe('string');
                expect(Object.values(LifecycleStatusEnum)).toContain(result.data.lifecycleState);
                expect(typeof result.data.currentRedemptions).toBe('number');
                expect(result.data.validFrom).toBeInstanceOf(Date);
            }
        });
    });
});
