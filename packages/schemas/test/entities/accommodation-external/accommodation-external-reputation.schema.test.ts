import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationExternalReputationSchema,
    ExternalFetchStatusSchema
} from '../../../src/entities/accommodation-external/accommodation-external-reputation.schema.js';
import { ExternalPlatformEnum } from '../../../src/enums/external-platform.enum.js';

// ============================================================================
// Test fixtures
// ============================================================================

const ACCOMMODATION_ID = '2235bff8-b5a3-4cca-a691-b6c3b64c1725';
const LISTING_ID = '2d52a0c0-eca6-4a18-81c0-67421cd17187';
const REPUTATION_ID = 'a1e82e67-6d1d-4c96-b337-a3dcfb71ef12';
const NOW = new Date('2025-01-15T12:00:00.000Z');

function buildValidReputation(overrides?: Record<string, unknown>) {
    return {
        id: REPUTATION_ID,
        accommodationId: ACCOMMODATION_ID,
        platform: ExternalPlatformEnum.GOOGLE,
        listingId: LISTING_ID,
        rating: 4.7,
        reviewsCount: 152,
        deepLink: 'https://maps.google.com/search?q=test#reviews',
        snippets: [
            {
                author: 'Alice',
                text: 'Great place to stay!',
                rating: 5,
                timeIso: '2025-01-10T08:00:00Z',
                relativeTime: 'hace 5 días'
            }
        ],
        snippetsFetchedAt: NOW,
        aggregateFetchedAt: NOW,
        fetchStatus: 'ok' as const,
        fetchMessage: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides
    };
}

// ============================================================================
// ExternalFetchStatusSchema
// ============================================================================

describe('ExternalFetchStatusSchema', () => {
    it('should accept "ok"', () => {
        expect(ExternalFetchStatusSchema.safeParse('ok').success).toBe(true);
    });

    it('should accept "blocked"', () => {
        expect(ExternalFetchStatusSchema.safeParse('blocked').success).toBe(true);
    });

    it('should accept "not_found"', () => {
        expect(ExternalFetchStatusSchema.safeParse('not_found').success).toBe(true);
    });

    it('should accept "error"', () => {
        expect(ExternalFetchStatusSchema.safeParse('error').success).toBe(true);
    });

    it('should reject an unknown status', () => {
        // Arrange / Act
        const result = ExternalFetchStatusSchema.safeParse('pending');
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBeInstanceOf(ZodError);
        }
    });

    it('should reject empty string', () => {
        expect(ExternalFetchStatusSchema.safeParse('').success).toBe(false);
    });
});

// ============================================================================
// AccommodationExternalReputationSchema
// ============================================================================

describe('AccommodationExternalReputationSchema', () => {
    it('should parse a fully-populated valid reputation record', () => {
        // Arrange
        const data = buildValidReputation();

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept null rating (not yet fetched)', () => {
        // Arrange
        const data = buildValidReputation({ rating: null });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.rating).toBeNull();
        }
    });

    it('should coerce rating from string to number (NUMERIC column behavior)', () => {
        // Arrange — Postgres NUMERIC columns arrive as strings from some drivers
        const data = buildValidReputation({ rating: '4.5' });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.rating).toBe(4.5);
        }
    });

    it('should accept null reviewsCount', () => {
        // Arrange
        const data = buildValidReputation({ reviewsCount: null });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept null snippets', () => {
        // Arrange
        const data = buildValidReputation({ snippets: null });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept null snippetsFetchedAt', () => {
        // Arrange
        const data = buildValidReputation({ snippetsFetchedAt: null });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should coerce createdAt from string to Date', () => {
        // Arrange
        const data = buildValidReputation({ createdAt: '2025-01-01T00:00:00.000Z' });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.createdAt).toBeInstanceOf(Date);
        }
    });

    it('should reject an invalid fetchStatus', () => {
        // Arrange
        const data = buildValidReputation({ fetchStatus: 'timeout' });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject a non-UUID listingId', () => {
        // Arrange
        const data = buildValidReputation({ listingId: 'not-a-uuid' });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject missing accommodationId', () => {
        // Arrange
        const { accommodationId: _omit, ...data } = buildValidReputation();

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject rating out of range (> 10)', () => {
        // Arrange
        const data = buildValidReputation({ rating: 11 });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject negative rating', () => {
        // Arrange
        const data = buildValidReputation({ rating: -1 });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject invalid deepLink URL', () => {
        // Arrange
        const data = buildValidReputation({ deepLink: 'not-a-url' });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should accept fetchStatus "blocked" with null aggregateFetchedAt', () => {
        // Arrange
        const data = buildValidReputation({
            fetchStatus: 'blocked',
            fetchMessage: 'CAPTCHA detected',
            aggregateFetchedAt: null
        });

        // Act
        const result = AccommodationExternalReputationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.fetchStatus).toBe('blocked');
            expect(result.data.fetchMessage).toBe('CAPTCHA detected');
        }
    });
});
