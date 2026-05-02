import { describe, expect, it } from 'vitest';
import {
    UserBookmarkCollectionCountByUserSchema,
    UserBookmarkCollectionCountResponseSchema,
    UserBookmarkCollectionFiltersSchema,
    UserBookmarkCollectionListItemSchema,
    UserBookmarkCollectionListResponseSchema,
    UserBookmarkCollectionSearchSchema,
    UserBookmarkCollectionsByUserSchema
} from '../../../src/entities/userBookmarkCollection/userBookmarkCollection.query.schema.js';
import { createPaginatedResponse } from '../../helpers/pagination.helpers.js';

// ============================================================================
// LIST ITEM FIXTURE
// ============================================================================

/** Minimal valid UserBookmarkCollectionListItem (fields required by the pick). */
const VALID_LIST_ITEM = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Viaje al Litoral',
    description: null,
    color: null,
    icon: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z')
} as const;

// ============================================================================
// UserBookmarkCollectionFiltersSchema
// ============================================================================

describe('UserBookmarkCollectionFiltersSchema', () => {
    it('should accept empty object (all filters optional)', () => {
        expect(() => UserBookmarkCollectionFiltersSchema.parse({})).not.toThrow();
    });

    it('should accept valid userId filter', () => {
        // Arrange
        const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).not.toThrow();
    });

    it('should reject invalid userId (non-UUID)', () => {
        // Arrange
        const input = { userId: 'not-a-uuid' };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).toThrow();
    });

    it('should accept nameContains string filter', () => {
        // Arrange
        const input = { nameContains: 'Litoral' };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).not.toThrow();
    });

    it('should accept hasBookmarks boolean true', () => {
        // Arrange
        const input = { hasBookmarks: true };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).not.toThrow();
    });

    it('should accept hasBookmarks boolean false', () => {
        // Arrange
        const input = { hasBookmarks: false };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).not.toThrow();
    });

    it('should default includeBookmarkCount to false when omitted', () => {
        // Act
        const result = UserBookmarkCollectionFiltersSchema.parse({});

        // Assert
        expect(result.includeBookmarkCount).toBe(false);
    });

    it('should accept includeBookmarkCount true', () => {
        // Arrange
        const input = { includeBookmarkCount: true };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).not.toThrow();
    });

    it('should accept all filters simultaneously', () => {
        // Arrange
        const input = {
            userId: '550e8400-e29b-41d4-a716-446655440001',
            nameContains: 'Litoral',
            hasBookmarks: true,
            includeBookmarkCount: true
        };

        // Act & Assert
        expect(() => UserBookmarkCollectionFiltersSchema.parse(input)).not.toThrow();
    });
});

// ============================================================================
// UserBookmarkCollectionSearchSchema
// ============================================================================

describe('UserBookmarkCollectionSearchSchema', () => {
    describe('pagination defaults', () => {
        it('should apply default page of 1 when omitted', () => {
            // Act
            const result = UserBookmarkCollectionSearchSchema.parse({});

            // Assert
            expect(result.page).toBe(1);
        });

        it('should apply default pageSize of 10 when omitted', () => {
            // Act
            const result = UserBookmarkCollectionSearchSchema.parse({});

            // Assert
            expect(result.pageSize).toBe(10);
        });
    });

    describe('pagination boundaries', () => {
        it('should accept page of 1 (minimum)', () => {
            // Arrange
            const input = { page: 1 };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should reject page of 0', () => {
            // Arrange
            const input = { page: 0 };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).toThrow();
        });

        it('should reject negative page', () => {
            // Arrange
            const input = { page: -1 };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).toThrow();
        });

        it('should accept pageSize of 100 (maximum)', () => {
            // Arrange
            const input = { pageSize: 100 };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should reject pageSize greater than 100', () => {
            // Arrange
            const input = { pageSize: 101 };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).toThrow();
        });

        it('should reject pageSize of 0', () => {
            // Arrange
            const input = { pageSize: 0 };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).toThrow();
        });
    });

    describe('sort fields', () => {
        it('should accept sortBy string', () => {
            // Arrange
            const input = { sortBy: 'name' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should accept sortOrder asc', () => {
            // Arrange
            const input = { sortOrder: 'asc' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should accept sortOrder desc', () => {
            // Arrange
            const input = { sortOrder: 'desc' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should reject invalid sortOrder value', () => {
            // Arrange
            const input = { sortOrder: 'random' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).toThrow();
        });
    });

    describe('filter combinations', () => {
        it('should accept userId filter', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should reject invalid userId in search schema', () => {
            // Arrange
            const input = { userId: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).toThrow();
        });

        it('should accept nameContains filter', () => {
            // Arrange
            const input = { nameContains: 'Viaje' };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should accept hasBookmarks boolean filter', () => {
            // Arrange
            const input = { hasBookmarks: true };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });

        it('should default includeBookmarkCount to false', () => {
            // Act
            const result = UserBookmarkCollectionSearchSchema.parse({});

            // Assert
            expect(result.includeBookmarkCount).toBe(false);
        });

        it('should accept full combination of all filters', () => {
            // Arrange
            const input = {
                page: 2,
                pageSize: 20,
                sortBy: 'name',
                sortOrder: 'asc',
                q: 'Litoral',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                nameContains: 'Viaje',
                hasBookmarks: true,
                includeBookmarkCount: true
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionSearchSchema.parse(input)).not.toThrow();
        });
    });
});

// ============================================================================
// UserBookmarkCollectionsByUserSchema
// ============================================================================

describe('UserBookmarkCollectionsByUserSchema', () => {
    describe('required fields', () => {
        it('should accept valid userId', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should reject missing userId', () => {
            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse({})).toThrow();
        });

        it('should reject non-UUID userId', () => {
            // Arrange
            const input = { userId: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).toThrow();
        });
    });

    describe('pagination defaults', () => {
        it('should apply default page of 1 when omitted', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act
            const result = UserBookmarkCollectionsByUserSchema.parse(input);

            // Assert
            expect(result.page).toBe(1);
        });

        it('should apply default pageSize of 10 when omitted', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act
            const result = UserBookmarkCollectionsByUserSchema.parse(input);

            // Assert
            expect(result.pageSize).toBe(10);
        });

        it('should apply default sortBy of createdAt when omitted', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act
            const result = UserBookmarkCollectionsByUserSchema.parse(input);

            // Assert
            expect(result.sortBy).toBe('createdAt');
        });

        it('should apply default sortOrder of asc when omitted', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act
            const result = UserBookmarkCollectionsByUserSchema.parse(input);

            // Assert
            expect(result.sortOrder).toBe('asc');
        });

        it('should default includeBookmarkCount to false', () => {
            // Arrange
            const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

            // Act
            const result = UserBookmarkCollectionsByUserSchema.parse(input);

            // Assert
            expect(result.includeBookmarkCount).toBe(false);
        });
    });

    describe('sortBy whitelist', () => {
        it('should accept sortBy name', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                sortBy: 'name'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should accept sortBy createdAt', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                sortBy: 'createdAt'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should accept sortBy bookmarkCount', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                sortBy: 'bookmarkCount'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should reject sortBy value not in whitelist', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                sortBy: 'updatedAt'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).toThrow();
        });
    });

    describe('pagination boundaries', () => {
        it('should accept page of 1 (minimum)', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                page: 1
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should reject page of 0', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                page: 0
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).toThrow();
        });

        it('should accept pageSize of 100 (maximum)', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                pageSize: 100
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should reject pageSize of 101', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                pageSize: 101
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).toThrow();
        });
    });

    describe('boolean filters', () => {
        it('should accept includeBookmarkCount true', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                includeBookmarkCount: true
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });

        it('should accept includeBookmarkCount false', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                includeBookmarkCount: false
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionsByUserSchema.parse(input)).not.toThrow();
        });
    });
});

// ============================================================================
// UserBookmarkCollectionCountByUserSchema
// ============================================================================

describe('UserBookmarkCollectionCountByUserSchema', () => {
    it('should accept valid userId', () => {
        // Arrange
        const input = { userId: '550e8400-e29b-41d4-a716-446655440001' };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountByUserSchema.parse(input)).not.toThrow();
    });

    it('should reject missing userId', () => {
        // Act & Assert
        expect(() => UserBookmarkCollectionCountByUserSchema.parse({})).toThrow();
    });

    it('should reject non-UUID userId', () => {
        // Arrange
        const input = { userId: 'not-a-uuid' };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountByUserSchema.parse(input)).toThrow();
    });
});

// ============================================================================
// UserBookmarkCollectionListItemSchema
// ============================================================================

describe('UserBookmarkCollectionListItemSchema', () => {
    it('should accept valid list item without bookmarkCount', () => {
        // Act & Assert
        expect(() => UserBookmarkCollectionListItemSchema.parse(VALID_LIST_ITEM)).not.toThrow();
    });

    it('should accept valid list item with optional bookmarkCount', () => {
        // Arrange
        const input = { ...VALID_LIST_ITEM, bookmarkCount: 5 };

        // Act & Assert
        expect(() => UserBookmarkCollectionListItemSchema.parse(input)).not.toThrow();
    });

    it('should accept bookmarkCount of 0', () => {
        // Arrange
        const input = { ...VALID_LIST_ITEM, bookmarkCount: 0 };

        // Act & Assert
        expect(() => UserBookmarkCollectionListItemSchema.parse(input)).not.toThrow();
    });

    it('should reject negative bookmarkCount', () => {
        // Arrange
        const input = { ...VALID_LIST_ITEM, bookmarkCount: -1 };

        // Act & Assert
        expect(() => UserBookmarkCollectionListItemSchema.parse(input)).toThrow();
    });

    it('should reject non-integer bookmarkCount', () => {
        // Arrange
        const input = { ...VALID_LIST_ITEM, bookmarkCount: 1.5 };

        // Act & Assert
        expect(() => UserBookmarkCollectionListItemSchema.parse(input)).toThrow();
    });
});

// ============================================================================
// UserBookmarkCollectionListResponseSchema
// ============================================================================

describe('UserBookmarkCollectionListResponseSchema', () => {
    it('should accept paginated response with empty data array', () => {
        // Arrange
        const output = createPaginatedResponse([], 1, 10, 0);

        // Act & Assert
        expect(() => UserBookmarkCollectionListResponseSchema.parse(output)).not.toThrow();
    });

    it('should accept paginated response with list items', () => {
        // Arrange
        const items = [
            VALID_LIST_ITEM,
            { ...VALID_LIST_ITEM, id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479' }
        ];
        const output = createPaginatedResponse(items, 1, 10, 2);

        // Act & Assert
        expect(() => UserBookmarkCollectionListResponseSchema.parse(output)).not.toThrow();
    });

    it('should reject output missing data field', () => {
        // Arrange
        const invalidOutput = {
            pagination: createPaginatedResponse([], 1, 10, 0).pagination
        };

        // Act & Assert
        expect(() => UserBookmarkCollectionListResponseSchema.parse(invalidOutput)).toThrow();
    });

    it('should reject output missing pagination field', () => {
        // Arrange
        const invalidOutput = { data: [] };

        // Act & Assert
        expect(() => UserBookmarkCollectionListResponseSchema.parse(invalidOutput)).toThrow();
    });
});

// ============================================================================
// UserBookmarkCollectionCountResponseSchema
// ============================================================================

describe('UserBookmarkCollectionCountResponseSchema', () => {
    it('should accept count of 0', () => {
        // Arrange
        const output = { count: 0 };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountResponseSchema.parse(output)).not.toThrow();
    });

    it('should accept positive integer count', () => {
        // Arrange
        const output = { count: 42 };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountResponseSchema.parse(output)).not.toThrow();
    });

    it('should reject negative count', () => {
        // Arrange
        const output = { count: -1 };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountResponseSchema.parse(output)).toThrow();
    });

    it('should reject non-integer count', () => {
        // Arrange
        const output = { count: 3.14 };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountResponseSchema.parse(output)).toThrow();
    });

    it('should reject string count', () => {
        // Arrange
        const output = { count: '42' };

        // Act & Assert
        expect(() => UserBookmarkCollectionCountResponseSchema.parse(output)).toThrow();
    });

    it('should reject missing count field', () => {
        // Act & Assert
        expect(() => UserBookmarkCollectionCountResponseSchema.parse({})).toThrow();
    });
});
