/**
 * Tests for post sponsorship HTTP schema converter functions.
 *
 * Verifies:
 * - PostSponsorshipSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainPostSponsorshipSearch passes boolean flags through
 * - httpToDomainPostSponsorshipCreate maps to domain create input with defaults
 * - httpToDomainPostSponsorshipUpdate conditionally maps only provided fields
 */
import { describe, expect, it } from 'vitest';
import {
    PostSponsorshipSearchHttpSchema,
    httpToDomainPostSponsorshipCreate,
    httpToDomainPostSponsorshipSearch,
    httpToDomainPostSponsorshipUpdate
} from '../../../src/entities/postSponsorship/postSponsorship.http.schema.js';
import { PriceCurrencyEnum } from '../../../src/enums/index.js';
import { LifecycleStatusEnum } from '../../../src/enums/index.js';

// ---------------------------------------------------------------------------
// Valid UUIDs for testing
// ---------------------------------------------------------------------------

const SPONSOR_UUID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const POST_UUID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

// ---------------------------------------------------------------------------
// PostSponsorshipSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('PostSponsorshipSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept sponsorId and postId UUID filters', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.sponsorId).toBe(SPONSOR_UUID);
            expect(result.data.postId).toBe(POST_UUID);
        }
    });

    it('should reject non-UUID sponsorId', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({ sponsorId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should coerce minPrice and maxPrice from strings to numbers', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({
            minPrice: '100',
            maxPrice: '5000'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.minPrice).toBe(100);
            expect(result.data.maxPrice).toBe(5000);
        }
    });

    it('should coerce isPaid from string "true" to boolean', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({ isPaid: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isPaid).toBe(true);
        }
    });

    it('should coerce isActive from string "false" to boolean', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({ isActive: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isActive).toBe(false);
        }
    });

    it('should accept currency enum filter', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({
            currency: PriceCurrencyEnum.ARS
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.currency).toBe(PriceCurrencyEnum.ARS);
        }
    });

    it('should coerce date filters from ISO strings', () => {
        const result = PostSponsorshipSearchHttpSchema.safeParse({
            paidAfter: '2024-01-01',
            paidBefore: '2024-12-31'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.paidAfter).toBeInstanceOf(Date);
            expect(result.data.paidBefore).toBeInstanceOf(Date);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPostSponsorshipSearch
// ---------------------------------------------------------------------------

describe('httpToDomainPostSponsorshipSearch', () => {
    it('should pass isPaid boolean flag through', () => {
        // Arrange
        const parsed = PostSponsorshipSearchHttpSchema.parse({ isPaid: 'true' });

        // Act
        const result = httpToDomainPostSponsorshipSearch(parsed);

        // Assert
        expect(result.isPaid).toBe(true);
    });

    it('should pass isExpired boolean flag through', () => {
        // Arrange
        const parsed = PostSponsorshipSearchHttpSchema.parse({ isExpired: 'false' });

        // Act
        const result = httpToDomainPostSponsorshipSearch(parsed);

        // Assert
        expect(result.isExpired).toBe(false);
    });

    it('should pass isActive boolean flag through', () => {
        // Arrange
        const parsed = PostSponsorshipSearchHttpSchema.parse({ isActive: 'true' });

        // Act
        const result = httpToDomainPostSponsorshipSearch(parsed);

        // Assert
        expect(result.isActive).toBe(true);
    });

    it('should pass sponsorId and postId through', () => {
        // Arrange
        const parsed = PostSponsorshipSearchHttpSchema.parse({
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID
        });

        // Act
        const result = httpToDomainPostSponsorshipSearch(parsed);

        // Assert
        expect(result.sponsorId).toBe(SPONSOR_UUID);
        expect(result.postId).toBe(POST_UUID);
    });

    it('should handle empty input', () => {
        // Arrange
        const parsed = PostSponsorshipSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainPostSponsorshipSearch(parsed);

        // Assert
        expect(result.isPaid).toBeUndefined();
        expect(result.isActive).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPostSponsorshipCreate
// ---------------------------------------------------------------------------

describe('httpToDomainPostSponsorshipCreate', () => {
    it('should map required fields to domain create input', () => {
        // Arrange
        const httpData = {
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID,
            description: 'A detailed sponsorship description for testing purposes here',
            price: 500,
            currency: PriceCurrencyEnum.ARS
        };

        // Act
        const result = httpToDomainPostSponsorshipCreate(httpData);

        // Assert
        expect(result.sponsorId).toBe(SPONSOR_UUID);
        expect(result.postId).toBe(POST_UUID);
        expect(result.description).toBe(
            'A detailed sponsorship description for testing purposes here'
        );
    });

    it('should nest price and currency into paid object', () => {
        // Arrange
        const httpData = {
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID,
            description: 'Sponsorship with price details for verification testing',
            price: 1000,
            currency: PriceCurrencyEnum.USD
        };

        // Act
        const result = httpToDomainPostSponsorshipCreate(httpData);

        // Assert
        expect(result.paid).toEqual({
            price: 1000,
            currency: PriceCurrencyEnum.USD
        });
    });

    it('should set lifecycleState to ACTIVE by default', () => {
        // Arrange
        const httpData = {
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID,
            description: 'Active sponsorship description with enough text to pass validation',
            price: 250,
            currency: PriceCurrencyEnum.ARS
        };

        // Act
        const result = httpToDomainPostSponsorshipCreate(httpData);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should set isHighlighted to false by default', () => {
        // Arrange
        const httpData = {
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID,
            description: 'Default highlighted state for this sponsorship test data',
            price: 300,
            currency: PriceCurrencyEnum.ARS
        };

        // Act
        const result = httpToDomainPostSponsorshipCreate(httpData);

        // Assert
        expect(result.isHighlighted).toBe(false);
    });

    it('should pass optional message through when provided', () => {
        // Arrange
        const httpData = {
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID,
            description: 'Sponsorship with optional message included in payload',
            message: 'Special offer!',
            price: 750,
            currency: PriceCurrencyEnum.ARS
        };

        // Act
        const result = httpToDomainPostSponsorshipCreate(httpData);

        // Assert
        expect(result.message).toBe('Special offer!');
    });

    it('should pass optional paidAt date when provided', () => {
        // Arrange
        const paidAt = new Date('2024-06-15');
        const httpData = {
            sponsorId: SPONSOR_UUID,
            postId: POST_UUID,
            description: 'Sponsorship with payment date already processed and recorded',
            price: 600,
            currency: PriceCurrencyEnum.USD,
            paidAt
        };

        // Act
        const result = httpToDomainPostSponsorshipCreate(httpData);

        // Assert
        expect(result.paidAt).toEqual(paidAt);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPostSponsorshipUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainPostSponsorshipUpdate', () => {
    it('should include description when provided', () => {
        // Arrange
        const httpData = { description: 'Updated description text for the sponsorship' };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result.description).toBe('Updated description text for the sponsorship');
    });

    it('should include message when provided', () => {
        // Arrange
        const httpData = { message: 'New promotional message' };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result.message).toBe('New promotional message');
    });

    it('should nest price and currency into paid when both provided', () => {
        // Arrange
        const httpData = { price: 2000, currency: PriceCurrencyEnum.USD };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result.paid).toEqual({ price: 2000, currency: PriceCurrencyEnum.USD });
    });

    it('should NOT nest paid when only price is provided (missing currency)', () => {
        // Arrange
        const httpData = { price: 500 };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert — requires BOTH price and currency to build paid object
        expect(result.paid).toBeUndefined();
    });

    it('should NOT nest paid when only currency is provided (missing price)', () => {
        // Arrange
        const httpData = { currency: PriceCurrencyEnum.ARS };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result.paid).toBeUndefined();
    });

    it('should include paidAt when provided', () => {
        // Arrange
        const paidAt = new Date('2024-09-01');
        const httpData = { paidAt };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result.paidAt).toEqual(paidAt);
    });

    it('should include date range fields when provided', () => {
        // Arrange
        const fromDate = new Date('2024-07-01');
        const toDate = new Date('2024-08-31');
        const httpData = { fromDate, toDate };

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result.fromDate).toEqual(fromDate);
        expect(result.toDate).toEqual(toDate);
    });

    it('should return empty object when no fields provided', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainPostSponsorshipUpdate(httpData);

        // Assert
        expect(result).toEqual({});
    });
});
