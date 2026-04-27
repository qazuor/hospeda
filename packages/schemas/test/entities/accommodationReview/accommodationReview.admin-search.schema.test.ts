import { describe, expect, it } from 'vitest';
import { AccommodationReviewAdminSearchSchema } from '../../../src/entities/accommodationReview/index.js';

describe('AccommodationReviewAdminSearchSchema', () => {
    describe('Default Values', () => {
        it('should parse an empty object with all defaults applied', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({});

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
            const input = { page: 3, pageSize: 50 };

            const result = AccommodationReviewAdminSearchSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(50);
            }
        });

        it('should coerce string page and pageSize to numbers', () => {
            const input = { page: '2', pageSize: '10' };

            const result = AccommodationReviewAdminSearchSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(10);
            }
        });

        it('should reject pageSize greater than 100', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ pageSize: 101 });
            expect(result.success).toBe(false);
        });

        it('should reject page less than 1', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
        });
    });

    describe('AccommodationReview-specific Filters', () => {
        it('should validate filter by accommodationId (UUID)', () => {
            const input = { accommodationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

            const result = AccommodationReviewAdminSearchSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.accommodationId).toBe(input.accommodationId);
            }
        });

        it('should reject non-UUID accommodationId', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                accommodationId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should validate filter by userId (UUID)', () => {
            const input = { userId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479' };

            const result = AccommodationReviewAdminSearchSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.userId).toBe(input.userId);
            }
        });

        it('should reject non-UUID userId', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ userId: 'invalid' });
            expect(result.success).toBe(false);
        });

        it('should validate minRating within 1-5 range (supports decimals)', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ minRating: 3.5 });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minRating).toBe(3.5);
            }
        });

        it('should coerce string minRating to number', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ minRating: '4.0' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minRating).toBe(4);
            }
        });

        it('should reject minRating below 1', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ minRating: 0.5 });
            expect(result.success).toBe(false);
        });

        it('should reject minRating above 5', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ minRating: 5.5 });
            expect(result.success).toBe(false);
        });

        it('should validate maxRating within 1-5 range', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ maxRating: 4.5 });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.maxRating).toBe(4.5);
            }
        });

        it('should reject maxRating below 1', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ maxRating: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject maxRating above 5', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ maxRating: 6 });
            expect(result.success).toBe(false);
        });
    });

    describe('Lifecycle Status Filter (via base status field, AC-001-01)', () => {
        // status is inherited from AdminSearchBaseSchema as an enum:
        // ['all', 'DRAFT', 'ACTIVE', 'ARCHIVED'] with default 'all'.
        // adminList() maps non-'all' values to lifecycleState filter.

        it('should default status to "all" when not provided', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('all');
            }
        });

        it('should accept status "DRAFT"', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ status: 'DRAFT' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('DRAFT');
            }
        });

        it('should accept status "ACTIVE"', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ status: 'ACTIVE' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ACTIVE');
            }
        });

        it('should accept status "ARCHIVED"', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ status: 'ARCHIVED' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ARCHIVED');
            }
        });

        it('should reject invalid status value', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ status: 'INVALID' });
            expect(result.success).toBe(false);
        });
    });

    describe('Base Admin Filters', () => {
        it('should validate text search filter', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                search: 'great stay'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.search).toBe('great stay');
            }
        });

        it('should validate sort parameter', () => {
            const validSorts = [
                'createdAt:asc',
                'createdAt:desc',
                'updatedAt:asc',
                'averageRating:desc'
            ];

            for (const sort of validSorts) {
                const result = AccommodationReviewAdminSearchSchema.safeParse({ sort });
                expect(result.success, `sort "${sort}" should be valid`).toBe(true);
            }
        });

        it('should reject invalid sort format', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ sort: 'createdAt' });
            expect(result.success).toBe(false);
        });

        it('should validate includeDeleted flag', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ includeDeleted: true });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(true);
            }
        });

        it('should validate createdAfter and createdBefore date filters', () => {
            const input = {
                createdAfter: '2024-01-01T00:00:00.000Z',
                createdBefore: '2024-12-31T23:59:59.000Z'
            };
            const result = AccommodationReviewAdminSearchSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
    });

    describe('Combined Filters', () => {
        it('should validate a full admin search with all filters combined', () => {
            const input = {
                page: 2,
                pageSize: 25,
                search: 'excellent',
                sort: 'createdAt:desc',
                status: 'ACTIVE',
                includeDeleted: false,
                accommodationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                userId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                minRating: 4,
                maxRating: 5
            };

            const result = AccommodationReviewAdminSearchSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(25);
                expect(result.data.status).toBe('ACTIVE');
                expect(result.data.accommodationId).toBe(input.accommodationId);
                expect(result.data.userId).toBe(input.userId);
                expect(result.data.minRating).toBe(4);
                expect(result.data.maxRating).toBe(5);
            }
        });

        it('should validate search with only status filter (lifecycleState proxy)', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({ status: 'ARCHIVED' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('ARCHIVED');
            }
        });
    });

    /**
     * GAP-005 (SPEC-049 T-068): includeDeleted is declared via queryBooleanParam()
     * in AdminSearchBaseSchema. This wrapper exists explicitly to avoid the
     * z.coerce.boolean() trap where Boolean('false') === true. Tests anchor the
     * full contract so any future change is intentional, not silent.
     */
    describe('includeDeleted coercion contract (GAP-005)', () => {
        it('should accept the boolean false', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                includeDeleted: false
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(false);
            }
        });

        it('should coerce the string "true" to true', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                includeDeleted: 'true'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(true);
            }
        });

        it('should coerce the string "false" to false (NOT true — guards the z.coerce.boolean trap)', () => {
            // This is the precise reason queryBooleanParam exists. Without it,
            // z.coerce.boolean() would interpret 'false' as truthy and silently
            // expose soft-deleted rows whenever the API received a string flag.
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                includeDeleted: 'false'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(false);
            }
        });

        it('should coerce the string "1" to true', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                includeDeleted: '1'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(true);
            }
        });

        it('should coerce the string "0" to false', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                includeDeleted: '0'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(false);
            }
        });

        it('should fall back to the default (false) for empty string', () => {
            // Empty string is mapped to undefined by the preprocess step, then
            // .default(false) on the wrapper kicks in.
            const result = AccommodationReviewAdminSearchSchema.safeParse({
                includeDeleted: ''
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(false);
            }
        });

        it('should default includeDeleted to false when omitted', () => {
            const result = AccommodationReviewAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(false);
            }
        });
    });
});
