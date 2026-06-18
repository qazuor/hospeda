import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationExternalListingSchema,
    CreateAccommodationExternalListingSchema,
    ExternalReviewSnippetSchema,
    UpdateAccommodationExternalListingSchema
} from '../../../src/entities/accommodation-external/accommodation-external-listing.schema.js';
import { ExternalPlatformEnum } from '../../../src/enums/external-platform.enum.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

// ============================================================================
// Test fixtures
// ============================================================================

const ACCOMMODATION_ID = '2235bff8-b5a3-4cca-a691-b6c3b64c1725';
const LISTING_ID = '2d52a0c0-eca6-4a18-81c0-67421cd17187';
const USER_ID = 'a1e82e67-6d1d-4c96-b337-a3dcfb71ef12';
const NOW = new Date('2025-01-01T00:00:00.000Z');

function buildValidListing(overrides?: Record<string, unknown>) {
    return {
        id: LISTING_ID,
        accommodationId: ACCOMMODATION_ID,
        platform: ExternalPlatformEnum.GOOGLE,
        url: 'https://maps.google.com/?cid=12345',
        externalId: 'ChIJ_test12345',
        showLink: false,
        showReviews: false,
        verified: false,
        createdAt: NOW,
        updatedAt: NOW,
        createdById: USER_ID,
        updatedById: USER_ID,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    };
}

// ============================================================================
// ExternalReviewSnippetSchema
// ============================================================================

describe('ExternalReviewSnippetSchema', () => {
    it('should accept a minimal valid snippet', () => {
        // Arrange
        const snippet = { author: 'Alice', text: 'Great place!' };

        // Act
        const result = ExternalReviewSnippetSchema.safeParse(snippet);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept a full snippet with all optional fields', () => {
        // Arrange
        const snippet = {
            author: 'Bob',
            text: 'Very clean and comfortable.',
            rating: 4.5,
            timeIso: '2025-01-15T10:00:00Z',
            authorUrl: 'https://example.com/bob',
            profilePhoto: 'https://example.com/bob.jpg',
            relativeTime: 'hace 2 semanas'
        };

        // Act
        const result = ExternalReviewSnippetSchema.safeParse(snippet);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject snippet missing author', () => {
        // Arrange
        const snippet = { text: 'No author here' };

        // Act
        const result = ExternalReviewSnippetSchema.safeParse(snippet);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject snippet missing text', () => {
        // Arrange
        const snippet = { author: 'Alice' };

        // Act
        const result = ExternalReviewSnippetSchema.safeParse(snippet);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject invalid URL for authorUrl', () => {
        // Arrange
        const snippet = { author: 'Alice', text: 'Great!', authorUrl: 'not-a-url' };

        // Act
        const result = ExternalReviewSnippetSchema.safeParse(snippet);

        // Assert
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// AccommodationExternalListingSchema
// ============================================================================

describe('AccommodationExternalListingSchema', () => {
    it('should parse a valid listing with all required fields', () => {
        // Arrange
        const data = buildValidListing();

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should default showLink to false when not provided', () => {
        // Arrange
        const data = buildValidListing({ showLink: undefined });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.showLink).toBe(false);
        }
    });

    it('should default showReviews to false when not provided', () => {
        // Arrange
        const data = buildValidListing({ showReviews: undefined });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.showReviews).toBe(false);
        }
    });

    it('should default verified to false when not provided', () => {
        // Arrange
        const data = buildValidListing({ verified: undefined });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.verified).toBe(false);
        }
    });

    it('should accept externalId as nullish', () => {
        // Arrange
        const data = buildValidListing({ externalId: null });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept all ExternalPlatformEnum values', () => {
        for (const platform of Object.values(ExternalPlatformEnum)) {
            // Arrange
            const data = buildValidListing({ platform });

            // Act
            const result = AccommodationExternalListingSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        }
    });

    it('should reject an invalid URL', () => {
        // Arrange
        const data = buildValidListing({ url: 'not-a-valid-url' });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject missing accommodationId', () => {
        // Arrange
        const { accommodationId: _omit, ...data } = buildValidListing();

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject an invalid platform', () => {
        // Arrange
        const data = buildValidListing({ platform: 'TRIPADVISOR' });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBeInstanceOf(ZodError);
        }
    });

    it('should reject a non-UUID id', () => {
        // Arrange
        const data = buildValidListing({ id: 'not-a-uuid' });

        // Act
        const result = AccommodationExternalListingSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// CreateAccommodationExternalListingSchema
// ============================================================================

describe('CreateAccommodationExternalListingSchema', () => {
    it('should accept valid create input without system-managed fields', () => {
        // Arrange
        const input = {
            accommodationId: ACCOMMODATION_ID,
            platform: ExternalPlatformEnum.BOOKING,
            url: 'https://www.booking.com/hotel/ar/test.html',
            showLink: true,
            showReviews: false
        };

        // Act
        const result = CreateAccommodationExternalListingSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should default showLink and showReviews to false', () => {
        // Arrange
        const input = {
            accommodationId: ACCOMMODATION_ID,
            platform: ExternalPlatformEnum.AIRBNB,
            url: 'https://www.airbnb.com/rooms/12345'
        };

        // Act
        const result = CreateAccommodationExternalListingSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.showLink).toBe(false);
            expect(result.data.showReviews).toBe(false);
        }
    });

    it('should not accept id (server-managed)', () => {
        // Arrange
        const input = {
            id: LISTING_ID,
            accommodationId: ACCOMMODATION_ID,
            platform: ExternalPlatformEnum.GOOGLE,
            url: 'https://maps.google.com/?cid=123'
        };

        // Act — schema omits id so passing it should be silently ignored or
        // rejected if strict is added; at minimum it must not appear in output
        const result = CreateAccommodationExternalListingSchema.safeParse(input);

        // Assert — it parses (the field is stripped / does not exist in the schema)
        // The schema uses .omit() which strips unknown keys in Zod v4 by default
        if (result.success) {
            // The inferred type has no `id` key, so this is a type-level guarantee
            expect('id' in result.data).toBe(false);
        }
    });

    it('should not accept verified (server-managed)', () => {
        // Arrange: verified is omitted from create schema
        const input = {
            accommodationId: ACCOMMODATION_ID,
            platform: ExternalPlatformEnum.GOOGLE,
            url: 'https://maps.google.com/?cid=123',
            verified: true
        };

        // Act
        const result = CreateAccommodationExternalListingSchema.safeParse(input);

        // Assert: the field is dropped by omit() — parse succeeds but verified is absent
        if (result.success) {
            expect('verified' in result.data).toBe(false);
        }
    });
});

// ============================================================================
// UpdateAccommodationExternalListingSchema
// ============================================================================

describe('UpdateAccommodationExternalListingSchema', () => {
    it('should accept an empty update object (all fields optional)', () => {
        // Arrange
        const input = {};

        // Act
        const result = UpdateAccommodationExternalListingSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept a partial update with only showLink', () => {
        // Arrange
        const input = { showLink: true };

        // Act
        const result = UpdateAccommodationExternalListingSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.showLink).toBe(true);
        }
    });

    it('should accept updating url and showReviews together', () => {
        // Arrange
        const input = {
            url: 'https://www.booking.com/hotel/ar/updated.html',
            showReviews: true
        };

        // Act
        const result = UpdateAccommodationExternalListingSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject an invalid URL in update', () => {
        // Arrange
        const input = { url: 'bad-url' };

        // Act
        const result = UpdateAccommodationExternalListingSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});
