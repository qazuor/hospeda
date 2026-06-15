/**
 * Tests for user bookmark collection HTTP schema converter functions.
 *
 * Verifies:
 * - UserBookmarkCollectionSearchHttpSchema coerces string query params
 * - httpToDomainUserBookmarkCollectionSearch maps to domain search input
 * - httpToDomainUserBookmarkCollectionCreate maps to domain create input
 * - httpToDomainUserBookmarkCollectionUpdate only passes provided fields
 */
import { describe, expect, it } from 'vitest';
import {
    UserBookmarkCollectionSearchHttpSchema,
    httpToDomainUserBookmarkCollectionCreate,
    httpToDomainUserBookmarkCollectionSearch,
    httpToDomainUserBookmarkCollectionUpdate
} from '../../../src/entities/userBookmarkCollection/userBookmarkCollection.http.schema.js';

// ---------------------------------------------------------------------------
// Valid UUIDs for testing
// ---------------------------------------------------------------------------

const USER_UUID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

// ---------------------------------------------------------------------------
// UserBookmarkCollectionSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('UserBookmarkCollectionSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept userId UUID filter', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({ userId: USER_UUID });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.userId).toBe(USER_UUID);
        }
    });

    it('should reject non-UUID userId', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({ userId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should coerce hasBookmarks from string "true" to boolean', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({ hasBookmarks: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasBookmarks).toBe(true);
        }
    });

    it('should coerce includeBookmarkCount from string "false" to boolean', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({
            includeBookmarkCount: 'false'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.includeBookmarkCount).toBe(false);
        }
    });

    it('should accept nameContains text filter', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({
            nameContains: 'favorites'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.nameContains).toBe('favorites');
        }
    });

    it('should coerce date filters from ISO strings', () => {
        const result = UserBookmarkCollectionSearchHttpSchema.safeParse({
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
// httpToDomainUserBookmarkCollectionSearch
// ---------------------------------------------------------------------------

describe('httpToDomainUserBookmarkCollectionSearch', () => {
    it('should map pagination fields to domain search input', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({ page: '3', pageSize: '25' });

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.page).toBe(3);
        expect(result.pageSize).toBe(25);
    });

    it('should map userId filter to domain search input', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({ userId: USER_UUID });

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.userId).toBe(USER_UUID);
    });

    it('should map nameContains to domain search input', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({ nameContains: 'travel' });

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.nameContains).toBe('travel');
    });

    it('should coerce hasBookmarks undefined to undefined in domain search', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.hasBookmarks).toBeUndefined();
    });

    it('should default includeBookmarkCount to false when not provided', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.includeBookmarkCount).toBe(false);
    });

    it('should set includeBookmarkCount to true when provided as true', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({
            includeBookmarkCount: 'true'
        });

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.includeBookmarkCount).toBe(true);
    });

    it('should set hasBookmarks to true when explicitly provided', () => {
        // Arrange
        const parsed = UserBookmarkCollectionSearchHttpSchema.parse({ hasBookmarks: 'true' });

        // Act
        const result = httpToDomainUserBookmarkCollectionSearch(parsed);

        // Assert
        expect(result.hasBookmarks).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserBookmarkCollectionCreate
// ---------------------------------------------------------------------------

describe('httpToDomainUserBookmarkCollectionCreate', () => {
    it('should map required fields to domain create input', () => {
        // Arrange
        const httpData = { userId: USER_UUID, name: 'My Favorites' };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.userId).toBe(USER_UUID);
        expect(result.name).toBe('My Favorites');
    });

    it('should default description to null when not provided', () => {
        // Arrange
        const httpData = { userId: USER_UUID, name: 'Collection A' };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.description).toBeNull();
    });

    it('should default color to null when not provided', () => {
        // Arrange
        const httpData = { userId: USER_UUID, name: 'Collection B' };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.color).toBeNull();
    });

    it('should default icon to null when not provided', () => {
        // Arrange
        const httpData = { userId: USER_UUID, name: 'Collection C' };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.icon).toBeNull();
    });

    it('should include description when provided', () => {
        // Arrange
        const httpData = {
            userId: USER_UUID,
            name: 'Trip collection',
            description: 'All my travel bookmarks'
        };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.description).toBe('All my travel bookmarks');
    });

    it('should include color when provided', () => {
        // Arrange
        const httpData = { userId: USER_UUID, name: 'Colored', color: '#FF5733' };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.color).toBe('#FF5733');
    });

    it('should include icon when provided', () => {
        // Arrange
        const httpData = { userId: USER_UUID, name: 'Iconic', icon: 'star' };

        // Act
        const result = httpToDomainUserBookmarkCollectionCreate(httpData);

        // Assert
        expect(result.icon).toBe('star');
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserBookmarkCollectionUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainUserBookmarkCollectionUpdate', () => {
    it('should include name when provided', () => {
        // Arrange
        const httpData = { name: 'New name' };

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect(result.name).toBe('New name');
    });

    it('should not include name when not provided', () => {
        // Arrange
        const httpData = { icon: 'heart' };

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect('name' in result).toBe(false);
    });

    it('should include description when provided', () => {
        // Arrange
        const httpData = { description: 'Updated description' };

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect(result.description).toBe('Updated description');
    });

    it('should include color when provided', () => {
        // Arrange
        const httpData = { color: '#00FF00' };

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect(result.color).toBe('#00FF00');
    });

    it('should include icon when provided', () => {
        // Arrange
        const httpData = { icon: 'bookmark' };

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect(result.icon).toBe('bookmark');
    });

    it('should return empty object when no fields provided', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect(result).toEqual({});
    });

    it('should only include explicitly-provided fields (no extra keys)', () => {
        // Arrange
        const httpData = { name: 'Only name' };

        // Act
        const result = httpToDomainUserBookmarkCollectionUpdate(httpData);

        // Assert
        expect(Object.keys(result)).toEqual(['name']);
    });
});
