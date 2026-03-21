import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationReviewAdminSearchSchema,
    DestinationReviewAdminSearchSchema
} from '../../../src/index.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

describe('Group D Admin Search Schemas (Reviews)', () => {
    describe('AccommodationReviewAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            // Arrange
            const input = {};

            // Act
            const result = AccommodationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.status).toBe('all');
            expect(result.sort).toBe('createdAt:desc');
            expect(result.includeDeleted).toBe(false);
            expect(result.accommodationId).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.minRating).toBeUndefined();
            expect(result.maxRating).toBeUndefined();
        });

        it('should accept all accommodation-review-specific filters', () => {
            // Arrange
            const input = {
                page: 2,
                pageSize: 50,
                search: 'great stay',
                sort: 'createdAt:desc',
                status: 'ACTIVE',
                includeDeleted: true,
                accommodationId: VALID_UUID,
                userId: VALID_UUID_2,
                minRating: 3.5,
                maxRating: 5,
                createdAfter: '2025-01-01T00:00:00.000Z',
                createdBefore: '2025-12-31T23:59:59.999Z'
            };

            // Act
            const result = AccommodationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(50);
            expect(result.search).toBe('great stay');
            expect(result.status).toBe('ACTIVE');
            expect(result.includeDeleted).toBe(true);
            expect(result.accommodationId).toBe(VALID_UUID);
            expect(result.userId).toBe(VALID_UUID_2);
            expect(result.minRating).toBe(3.5);
            expect(result.maxRating).toBe(5);
            expect(result.createdAfter).toBeInstanceOf(Date);
            expect(result.createdBefore).toBeInstanceOf(Date);
        });

        it('should allow decimal minRating and maxRating (no .int() constraint)', () => {
            // Arrange
            const input = { minRating: 2.7, maxRating: 4.3 };

            // Act
            const result = AccommodationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.minRating).toBe(2.7);
            expect(result.maxRating).toBe(4.3);
        });

        it('should coerce string rating values to numbers', () => {
            // Arrange
            const input = { minRating: '3', maxRating: '4.5' };

            // Act
            const result = AccommodationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.minRating).toBe(3);
            expect(result.maxRating).toBe(4.5);
        });

        it('should reject minRating below 1', () => {
            // Arrange
            const input = { minRating: 0 };

            // Act & Assert
            expect(() => AccommodationReviewAdminSearchSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject minRating above 5', () => {
            // Arrange
            const input = { minRating: 6 };

            // Act & Assert
            expect(() => AccommodationReviewAdminSearchSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject maxRating below 1', () => {
            // Arrange
            const input = { maxRating: 0 };

            // Act & Assert
            expect(() => AccommodationReviewAdminSearchSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject maxRating above 5', () => {
            // Arrange
            const input = { maxRating: 5.1 };

            // Act & Assert
            expect(() => AccommodationReviewAdminSearchSchema.parse(input)).toThrow(ZodError);
        });

        it('should accept boundary rating values (1 and 5)', () => {
            // Arrange
            const input = { minRating: 1, maxRating: 5 };

            // Act
            const result = AccommodationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.minRating).toBe(1);
            expect(result.maxRating).toBe(5);
        });

        it('should reject invalid UUID for accommodationId', () => {
            // Arrange
            const input = { accommodationId: 'not-a-uuid' };

            // Act & Assert
            expect(() => AccommodationReviewAdminSearchSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid UUID for userId', () => {
            // Arrange
            const input = { userId: 'invalid' };

            // Act & Assert
            expect(() => AccommodationReviewAdminSearchSchema.parse(input)).toThrow(ZodError);
        });

        it('should omit optional fields when not provided', () => {
            // Arrange
            const input = { page: 1 };

            // Act
            const result = AccommodationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.accommodationId).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.minRating).toBeUndefined();
            expect(result.maxRating).toBeUndefined();
            expect(result.search).toBeUndefined();
            expect(result.createdAfter).toBeUndefined();
            expect(result.createdBefore).toBeUndefined();
        });
    });

    describe('DestinationReviewAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            // Arrange
            const input = {};

            // Act
            const result = DestinationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.sort).toBe('createdAt:desc');
            expect(result.includeDeleted).toBe(false);
            expect(result.destinationId).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.minRating).toBeUndefined();
            expect(result.maxRating).toBeUndefined();
        });

        it('should always resolve status to "all" regardless of input', () => {
            // Arrange -- destination_reviews has no lifecycleState column
            const inputWithStatus = { status: 'ACTIVE' };
            const inputWithDraft = { status: 'DRAFT' };
            const inputEmpty = {};

            // Act
            const result1 = DestinationReviewAdminSearchSchema.parse(inputWithStatus);
            const result2 = DestinationReviewAdminSearchSchema.parse(inputWithDraft);
            const result3 = DestinationReviewAdminSearchSchema.parse(inputEmpty);

            // Assert -- status is always forced to 'all'
            expect(result1.status).toBe('all');
            expect(result2.status).toBe('all');
            expect(result3.status).toBe('all');
        });

        it('should accept all destination-review-specific filters', () => {
            // Arrange
            const input = {
                page: 3,
                pageSize: 25,
                search: 'beautiful place',
                includeDeleted: true,
                destinationId: VALID_UUID,
                userId: VALID_UUID_2,
                minRating: 4.0,
                maxRating: 5,
                createdAfter: '2025-06-01T00:00:00.000Z'
            };

            // Act
            const result = DestinationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.page).toBe(3);
            expect(result.pageSize).toBe(25);
            expect(result.search).toBe('beautiful place');
            expect(result.includeDeleted).toBe(true);
            expect(result.destinationId).toBe(VALID_UUID);
            expect(result.userId).toBe(VALID_UUID_2);
            expect(result.minRating).toBe(4.0);
            expect(result.maxRating).toBe(5);
            expect(result.createdAfter).toBeInstanceOf(Date);
        });

        it('should allow decimal minRating and maxRating', () => {
            // Arrange
            const input = { minRating: 1.5, maxRating: 4.8 };

            // Act
            const result = DestinationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.minRating).toBe(1.5);
            expect(result.maxRating).toBe(4.8);
        });

        it('should coerce string rating values to numbers', () => {
            // Arrange
            const input = { minRating: '2', maxRating: '4' };

            // Act
            const result = DestinationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.minRating).toBe(2);
            expect(result.maxRating).toBe(4);
        });

        it('should reject minRating below 1', () => {
            expect(() => DestinationReviewAdminSearchSchema.parse({ minRating: 0 })).toThrow(
                ZodError
            );
        });

        it('should reject minRating above 5', () => {
            expect(() => DestinationReviewAdminSearchSchema.parse({ minRating: 6 })).toThrow(
                ZodError
            );
        });

        it('should reject maxRating below 1', () => {
            expect(() => DestinationReviewAdminSearchSchema.parse({ maxRating: 0.5 })).toThrow(
                ZodError
            );
        });

        it('should reject maxRating above 5', () => {
            expect(() => DestinationReviewAdminSearchSchema.parse({ maxRating: 5.01 })).toThrow(
                ZodError
            );
        });

        it('should accept boundary rating values (1 and 5)', () => {
            // Arrange
            const input = { minRating: 1, maxRating: 5 };

            // Act
            const result = DestinationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.minRating).toBe(1);
            expect(result.maxRating).toBe(5);
        });

        it('should reject invalid UUID for destinationId', () => {
            expect(() =>
                DestinationReviewAdminSearchSchema.parse({ destinationId: 'invalid' })
            ).toThrow(ZodError);
        });

        it('should reject invalid UUID for userId', () => {
            expect(() => DestinationReviewAdminSearchSchema.parse({ userId: 'not-valid' })).toThrow(
                ZodError
            );
        });

        it('should omit optional fields when not provided', () => {
            // Arrange
            const input = { page: 2 };

            // Act
            const result = DestinationReviewAdminSearchSchema.parse(input);

            // Assert
            expect(result.destinationId).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.minRating).toBeUndefined();
            expect(result.maxRating).toBeUndefined();
            expect(result.search).toBeUndefined();
            expect(result.createdAfter).toBeUndefined();
            expect(result.createdBefore).toBeUndefined();
        });
    });
});
