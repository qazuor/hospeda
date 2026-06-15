/**
 * Tests for user bookmark HTTP schema converter functions.
 *
 * Verifies:
 * - UserBookmarkSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainUserBookmarkSearch maps entity ID to entityId field
 * - httpToDomainUserBookmarkCreate determines entityType from which ID is provided
 * - httpToDomainUserBookmarkUpdate maps notes to description
 */
import { describe, expect, it } from 'vitest';
import {
    UserBookmarkSearchHttpSchema,
    httpToDomainUserBookmarkCreate,
    httpToDomainUserBookmarkSearch,
    httpToDomainUserBookmarkUpdate
} from '../../../src/entities/userBookmark/userBookmark.http.schema.js';
import { EntityTypeEnum } from '../../../src/enums/entity-type.enum.js';

// ---------------------------------------------------------------------------
// Valid UUIDs for testing
// ---------------------------------------------------------------------------

const USER_UUID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const ACCOMMODATION_UUID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';
const DESTINATION_UUID = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3';
const POST_UUID = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';
const EVENT_UUID = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';

// ---------------------------------------------------------------------------
// UserBookmarkSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('UserBookmarkSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept userId UUID filter', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ userId: USER_UUID });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.userId).toBe(USER_UUID);
        }
    });

    it('should accept accommodationId UUID filter', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({
            accommodationId: ACCOMMODATION_UUID
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.accommodationId).toBe(ACCOMMODATION_UUID);
        }
    });

    it('should reject non-UUID userId', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ userId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should coerce hasAccommodation from string "true" to boolean', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ hasAccommodation: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasAccommodation).toBe(true);
        }
    });

    it('should coerce isActive from string "false" to boolean', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ isActive: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isActive).toBe(false);
        }
    });

    it('should accept bookmarkType enum filter', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ bookmarkType: 'accommodation' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.bookmarkType).toBe('accommodation');
        }
    });

    it('should reject invalid bookmarkType value', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ bookmarkType: 'unknown-type' });
        expect(result.success).toBe(false);
    });

    it('should coerce bookmarkCount from string to number', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({ bookmarkCount: '5' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.bookmarkCount).toBe(5);
        }
    });

    it('should coerce date range filters from ISO strings', () => {
        const result = UserBookmarkSearchHttpSchema.safeParse({
            createdAfter: '2024-01-01',
            createdBefore: '2024-12-31'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.createdAfter).toBeInstanceOf(Date);
            expect(result.data.createdBefore).toBeInstanceOf(Date);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserBookmarkSearch
// ---------------------------------------------------------------------------

describe('httpToDomainUserBookmarkSearch', () => {
    it('should map userId to domain search', () => {
        // Arrange
        const parsed = UserBookmarkSearchHttpSchema.parse({ userId: USER_UUID });

        // Act
        const result = httpToDomainUserBookmarkSearch(parsed);

        // Assert
        expect(result.userId).toBe(USER_UUID);
    });

    it('should map accommodationId to entityId field', () => {
        // Arrange
        const parsed = UserBookmarkSearchHttpSchema.parse({
            accommodationId: ACCOMMODATION_UUID
        });

        // Act
        const result = httpToDomainUserBookmarkSearch(parsed);

        // Assert
        expect(result.entityId).toBe(ACCOMMODATION_UUID);
    });

    it('should use destinationId for entityId when accommodationId is absent', () => {
        // Arrange
        const parsed = UserBookmarkSearchHttpSchema.parse({
            destinationId: DESTINATION_UUID
        });

        // Act
        const result = httpToDomainUserBookmarkSearch(parsed);

        // Assert
        expect(result.entityId).toBe(DESTINATION_UUID);
    });

    it('should map pagination fields to domain search', () => {
        // Arrange
        const parsed = UserBookmarkSearchHttpSchema.parse({ page: '3', pageSize: '10' });

        // Act
        const result = httpToDomainUserBookmarkSearch(parsed);

        // Assert
        expect(result.page).toBe(3);
        expect(result.pageSize).toBe(10);
    });

    it('should handle empty input with undefined entityId', () => {
        // Arrange
        const parsed = UserBookmarkSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainUserBookmarkSearch(parsed);

        // Assert
        expect(result.userId).toBeUndefined();
        expect(result.entityId).toBeFalsy(); // resolves to undefined when all IDs absent
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserBookmarkCreate
// ---------------------------------------------------------------------------

describe('httpToDomainUserBookmarkCreate', () => {
    it('should map accommodationId to entityId with ACCOMMODATION entityType', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            accommodationId: ACCOMMODATION_UUID
        };

        // Act
        const result = httpToDomainUserBookmarkCreate(httpData);

        // Assert
        expect(result.entityId).toBe(ACCOMMODATION_UUID);
        expect(result.entityType).toBe(EntityTypeEnum.ACCOMMODATION);
        expect(result.userId).toBe(USER_UUID);
    });

    it('should map destinationId to entityId with DESTINATION entityType', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            destinationId: DESTINATION_UUID
        };

        // Act
        const result = httpToDomainUserBookmarkCreate(httpData);

        // Assert
        expect(result.entityId).toBe(DESTINATION_UUID);
        expect(result.entityType).toBe(EntityTypeEnum.DESTINATION);
    });

    it('should map postId to entityId with POST entityType', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            postId: POST_UUID
        };

        // Act
        const result = httpToDomainUserBookmarkCreate(httpData);

        // Assert
        expect(result.entityId).toBe(POST_UUID);
        expect(result.entityType).toBe(EntityTypeEnum.POST);
    });

    it('should map eventId to entityId with EVENT entityType', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            eventId: EVENT_UUID
        };

        // Act
        const result = httpToDomainUserBookmarkCreate(httpData);

        // Assert
        expect(result.entityId).toBe(EVENT_UUID);
        expect(result.entityType).toBe(EntityTypeEnum.EVENT);
    });

    it('should map notes to description field', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            accommodationId: ACCOMMODATION_UUID,
            notes: 'Must visit next summer'
        };

        // Act
        const result = httpToDomainUserBookmarkCreate(httpData);

        // Assert
        expect(result.description).toBe('Must visit next summer');
    });

    it('should set name to undefined', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            accommodationId: ACCOMMODATION_UUID
        };

        // Act
        const result = httpToDomainUserBookmarkCreate(httpData);

        // Assert
        expect(result.name).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserBookmarkUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainUserBookmarkUpdate', () => {
    it('should map notes to description', () => {
        // Arrange
        const httpData = { notes: 'Updated note' };

        // Act
        const result = httpToDomainUserBookmarkUpdate(httpData);

        // Assert
        expect(result.description).toBe('Updated note');
    });

    it('should set description to undefined when notes is not provided', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainUserBookmarkUpdate(httpData);

        // Assert
        expect(result.description).toBeUndefined();
    });
});
