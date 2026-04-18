import { describe, expect, it } from 'vitest';
import { DestinationReviewAdminSearchSchema } from '../../../src/entities/destinationReview/index.js';

describe('DestinationReviewAdminSearchSchema', () => {
    describe('Default Values', () => {
        it('should parse an empty object with all defaults applied', () => {
            // Arrange & Act
            const result = DestinationReviewAdminSearchSchema.safeParse({});

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
    });

    describe('Pagination Filters', () => {
        it('should validate custom page and pageSize', () => {
            // Arrange
            const input = { page: 3, pageSize: 50 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

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
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

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
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject page less than 1', () => {
            // Arrange
            const input = { page: 0 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('DestinationReview-specific Filters', () => {
        it('should validate filter by destinationId (UUID)', () => {
            // Arrange
            const input = { destinationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(input.destinationId);
            }
        });

        it('should reject non-UUID destinationId', () => {
            // Arrange
            const input = { destinationId: 'not-a-uuid' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate filter by userId (UUID)', () => {
            // Arrange
            const input = { userId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.userId).toBe(input.userId);
            }
        });

        it('should reject non-UUID userId', () => {
            // Arrange
            const input = { userId: 'invalid-id' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate minRating within 1-5 range (supports decimals)', () => {
            // Arrange
            const input = { minRating: 3.5 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minRating).toBe(3.5);
            }
        });

        it('should coerce string minRating to number', () => {
            // Arrange
            const input = { minRating: '4.0' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minRating).toBe(4);
            }
        });

        it('should reject minRating below 1', () => {
            // Arrange
            const input = { minRating: 0.5 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject minRating above 5', () => {
            // Arrange
            const input = { minRating: 5.5 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate maxRating within 1-5 range', () => {
            // Arrange
            const input = { maxRating: 4.5 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.maxRating).toBe(4.5);
            }
        });

        it('should reject maxRating below 1', () => {
            // Arrange
            const input = { maxRating: 0 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject maxRating above 5', () => {
            // Arrange
            const input = { maxRating: 6 };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('Lifecycle Status Filter (via base status field)', () => {
        // status is inherited from AdminSearchBaseSchema as an enum:
        // ['all', 'DRAFT', 'ACTIVE', 'ARCHIVED'] with default 'all'.
        // adminList() maps non-'all' values to lifecycleState filter.
        // SPEC-063 T-034 removed the prior z.unknown().transform workaround
        // that forced status to 'all' because the DB column did not yet exist.

        it('should default status to "all" when not provided', () => {
            // Arrange & Act
            const result = DestinationReviewAdminSearchSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('all');
            }
        });

        it('should accept status "DRAFT"', () => {
            // Arrange & Act
            const result = DestinationReviewAdminSearchSchema.safeParse({ status: 'DRAFT' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('DRAFT');
            }
        });

        it('should accept status "ACTIVE"', () => {
            // Arrange & Act
            const result = DestinationReviewAdminSearchSchema.safeParse({ status: 'ACTIVE' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ACTIVE');
            }
        });

        it('should accept status "ARCHIVED"', () => {
            // Arrange & Act
            const result = DestinationReviewAdminSearchSchema.safeParse({ status: 'ARCHIVED' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ARCHIVED');
            }
        });

        it('should reject invalid status value', () => {
            // Arrange & Act
            const result = DestinationReviewAdminSearchSchema.safeParse({ status: 'INVALID' });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('Base Admin Filters', () => {
        it('should validate text search filter', () => {
            // Arrange
            const input = { search: 'great destination' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.search).toBe('great destination');
            }
        });

        it('should validate sort parameter', () => {
            // Arrange
            const validSorts = [
                'createdAt:asc',
                'createdAt:desc',
                'updatedAt:asc',
                'averageRating:desc'
            ];

            // Act & Assert
            for (const sort of validSorts) {
                const result = DestinationReviewAdminSearchSchema.safeParse({ sort });
                expect(result.success, `sort "${sort}" should be valid`).toBe(true);
            }
        });

        it('should reject invalid sort format', () => {
            // Arrange
            const input = { sort: 'createdAt' }; // missing direction

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should validate includeDeleted flag', () => {
            // Arrange
            const input = { includeDeleted: true };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

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
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

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
                search: 'patagonia',
                sort: 'createdAt:desc',
                status: 'ACTIVE',
                includeDeleted: false,
                destinationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                userId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                minRating: 4,
                maxRating: 5
            };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(25);
                expect(result.data.status).toBe('ACTIVE');
                expect(result.data.destinationId).toBe(input.destinationId);
                expect(result.data.userId).toBe(input.userId);
                expect(result.data.minRating).toBe(4);
                expect(result.data.maxRating).toBe(5);
            }
        });

        it('should validate search with only destinationId filter', () => {
            // Arrange
            const input = { destinationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate search with only status filter (lifecycleState proxy)', () => {
            // Arrange
            const input = { status: 'ARCHIVED' };

            // Act
            const result = DestinationReviewAdminSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ARCHIVED');
            }
        });
    });
});
