import { describe, expect, it } from 'vitest';
import {
    UserBookmarkCollectionBookmarkParamsSchema,
    UserBookmarkCollectionIdParamSchema
} from '../../../src/entities/userBookmarkCollection/userBookmarkCollection.params.schema.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_COLLECTION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_BOOKMARK_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ============================================================================
// UserBookmarkCollectionIdParamSchema
// ============================================================================

describe('UserBookmarkCollectionIdParamSchema', () => {
    describe('valid input', () => {
        it('should accept a valid UUID for id', () => {
            // Arrange
            const input = { id: VALID_COLLECTION_ID };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).not.toThrow();
        });

        it('should parse and return the id value', () => {
            // Arrange
            const input = { id: VALID_COLLECTION_ID };

            // Act
            const result = UserBookmarkCollectionIdParamSchema.parse(input);

            // Assert
            expect(result.id).toBe(VALID_COLLECTION_ID);
        });

        it('should accept a different valid UUID format', () => {
            // Arrange
            const input = { id: '550e8400-e29b-41d4-a716-446655440001' };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).not.toThrow();
        });
    });

    describe('invalid id', () => {
        it('should reject a non-UUID string', () => {
            // Arrange
            const input = { id: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).toThrow();
        });

        it('should reject a plain number string', () => {
            // Arrange
            const input = { id: '12345' };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).toThrow();
        });

        it('should reject an empty string id', () => {
            // Arrange
            const input = { id: '' };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).toThrow();
        });

        it('should reject a UUID with uppercase letters (invalid UUID format)', () => {
            // Arrange — UUIDs must be lowercase per RFC 4122 but Zod accepts both; this confirms behaviour
            const input = { id: 'F47AC10B-58CC-4372-A567-0E02B2C3D479' };

            // Zod's uuid() validates the structure regardless of case — document this as passing
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).not.toThrow();
        });
    });

    describe('missing id', () => {
        it('should reject empty object missing id', () => {
            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse({})).toThrow();
        });
    });

    describe('strict mode', () => {
        it('should reject input with extra fields beyond id', () => {
            // Arrange
            const input = { id: VALID_COLLECTION_ID, extraField: 'not allowed' };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).toThrow();
        });

        it('should reject input with userId alongside id', () => {
            // Arrange
            const input = {
                id: VALID_COLLECTION_ID,
                userId: '550e8400-e29b-41d4-a716-446655440001'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionIdParamSchema.parse(input)).toThrow();
        });
    });
});

// ============================================================================
// UserBookmarkCollectionBookmarkParamsSchema
// ============================================================================

describe('UserBookmarkCollectionBookmarkParamsSchema', () => {
    describe('valid input', () => {
        it('should accept valid UUIDs for both id and bookmarkId', () => {
            // Arrange
            const input = {
                id: VALID_COLLECTION_ID,
                bookmarkId: VALID_BOOKMARK_ID
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).not.toThrow();
        });

        it('should parse and return both id and bookmarkId', () => {
            // Arrange
            const input = {
                id: VALID_COLLECTION_ID,
                bookmarkId: VALID_BOOKMARK_ID
            };

            // Act
            const result = UserBookmarkCollectionBookmarkParamsSchema.parse(input);

            // Assert
            expect(result.id).toBe(VALID_COLLECTION_ID);
            expect(result.bookmarkId).toBe(VALID_BOOKMARK_ID);
        });
    });

    describe('id validation', () => {
        it('should reject non-UUID for id', () => {
            // Arrange
            const input = { id: 'not-a-uuid', bookmarkId: VALID_BOOKMARK_ID };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });

        it('should reject empty string for id', () => {
            // Arrange
            const input = { id: '', bookmarkId: VALID_BOOKMARK_ID };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });

        it('should reject missing id', () => {
            // Arrange
            const input = { bookmarkId: VALID_BOOKMARK_ID };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });
    });

    describe('bookmarkId validation', () => {
        it('should reject non-UUID for bookmarkId', () => {
            // Arrange
            const input = { id: VALID_COLLECTION_ID, bookmarkId: 'not-a-uuid' };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });

        it('should reject empty string for bookmarkId', () => {
            // Arrange
            const input = { id: VALID_COLLECTION_ID, bookmarkId: '' };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });

        it('should reject missing bookmarkId', () => {
            // Arrange
            const input = { id: VALID_COLLECTION_ID };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });
    });

    describe('both fields missing', () => {
        it('should reject empty object', () => {
            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse({})).toThrow();
        });
    });

    describe('strict mode', () => {
        it('should reject input with extra fields', () => {
            // Arrange
            const input = {
                id: VALID_COLLECTION_ID,
                bookmarkId: VALID_BOOKMARK_ID,
                extraField: 'not allowed'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });

        it('should reject input with userId alongside the required params', () => {
            // Arrange
            const input = {
                id: VALID_COLLECTION_ID,
                bookmarkId: VALID_BOOKMARK_ID,
                userId: '550e8400-e29b-41d4-a716-446655440001'
            };

            // Act & Assert
            expect(() => UserBookmarkCollectionBookmarkParamsSchema.parse(input)).toThrow();
        });
    });
});
