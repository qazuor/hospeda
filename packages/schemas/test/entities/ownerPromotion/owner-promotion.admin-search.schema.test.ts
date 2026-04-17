import { describe, expect, it } from 'vitest';
import { OwnerPromotionAdminSearchSchema } from '../../../src/entities/ownerPromotion/index.js';
import { OwnerPromotionDiscountTypeEnum } from '../../../src/enums/owner-promotion-discount-type.enum.js';

describe('OwnerPromotionAdminSearchSchema', () => {
    describe('Default Values', () => {
        it('should parse an empty object with all defaults applied', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.sort).toBe('createdAt:desc');
                expect(result.data.status).toBe('all');
                expect(result.data.includeDeleted).toBe(false);
            }
        });

        it('should use default page=1 and pageSize=20 when not provided', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
            }
        });
    });

    describe('Pagination Filters', () => {
        it('should validate custom page and pageSize', () => {
            // Arrange
            const input = { page: 3, pageSize: 50 };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(50);
            }
        });

        it('should coerce string page and pageSize to numbers', () => {
            // Arrange
            const input = { page: '2', pageSize: '10' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(10);
            }
        });

        it('should reject pageSize greater than 100', () => {
            // Arrange
            const input = { pageSize: 101 };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject page less than 1', () => {
            // Arrange
            const input = { page: 0 };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('OwnerPromotion-specific Filters', () => {
        it('should validate filter by ownerId (UUID)', () => {
            // Arrange
            const input = { ownerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ownerId).toBe(input.ownerId);
            }
        });

        it('should reject non-UUID ownerId', () => {
            // Arrange
            const input = { ownerId: 'not-a-uuid' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate filter by accommodationId (UUID)', () => {
            // Arrange
            const input = { accommodationId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.accommodationId).toBe(input.accommodationId);
            }
        });

        it('should reject non-UUID accommodationId', () => {
            // Arrange
            const input = { accommodationId: 'invalid-id' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate each discountType enum value', () => {
            // Arrange & Act & Assert
            for (const discountType of Object.values(OwnerPromotionDiscountTypeEnum)) {
                const result = OwnerPromotionAdminSearchSchema.safeParse({ discountType });
                expect(result.success, `discountType "${discountType}" should be valid`).toBe(true);
            }
        });

        it('should reject invalid discountType', () => {
            // Arrange
            const input = { discountType: 'INVALID_DISCOUNT' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('Lifecycle Status Filter (via base status field)', () => {
        // status is inherited from AdminSearchBaseSchema as an enum:
        // ['all', 'DRAFT', 'ACTIVE', 'ARCHIVED'] with default 'all'.
        // adminList() maps non-'all' values to lifecycleState filter.

        it('should default status to "all" when not provided', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('all');
            }
        });

        it('should accept status "DRAFT"', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({ status: 'DRAFT' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('DRAFT');
            }
        });

        it('should accept status "ACTIVE"', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({ status: 'ACTIVE' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ACTIVE');
            }
        });

        it('should accept status "ARCHIVED"', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({ status: 'ARCHIVED' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ARCHIVED');
            }
        });

        it('should reject invalid status value', () => {
            // Arrange & Act
            const result = OwnerPromotionAdminSearchSchema.safeParse({ status: 'INVALID' });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('Base Admin Filters', () => {
        it('should validate text search filter', () => {
            // Arrange
            const input = { search: 'summer discount' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.search).toBe('summer discount');
            }
        });

        it('should validate sort parameter', () => {
            // Arrange
            const validSorts = ['title:asc', 'title:desc', 'createdAt:asc', 'discountValue:desc'];

            // Act & Assert
            for (const sort of validSorts) {
                const result = OwnerPromotionAdminSearchSchema.safeParse({ sort });
                expect(result.success, `sort "${sort}" should be valid`).toBe(true);
            }
        });

        it('should reject invalid sort format', () => {
            // Arrange
            const input = { sort: 'title' }; // missing direction

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate includeDeleted flag', () => {
            // Arrange
            const input = { includeDeleted: true };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(true);
            }
        });

        it('should validate createdAfter and createdBefore date filters', () => {
            // Arrange
            const input = {
                createdAfter: '2024-01-01T00:00:00.000Z',
                createdBefore: '2024-12-31T23:59:59.000Z'
            };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Combined Filters', () => {
        it('should validate a full admin search with all filters combined', () => {
            // Arrange
            const input = {
                page: 2,
                pageSize: 25,
                search: 'summer',
                sort: 'createdAt:desc',
                status: 'ACTIVE',
                includeDeleted: false,
                ownerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                accommodationId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE
            };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(25);
                expect(result.data.status).toBe('ACTIVE');
                expect(result.data.discountType).toBe(OwnerPromotionDiscountTypeEnum.PERCENTAGE);
            }
        });

        it('should validate search with only ownerId filter', () => {
            // Arrange
            const input = { ownerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate search with only discountType filter', () => {
            // Arrange
            const input = { discountType: OwnerPromotionDiscountTypeEnum.FIXED };

            // Act
            const result = OwnerPromotionAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountType).toBe(OwnerPromotionDiscountTypeEnum.FIXED);
            }
        });
    });
});
