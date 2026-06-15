/**
 * Tests for destination HTTP schema converter functions.
 *
 * Verifies:
 * - DestinationSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainDestinationSearch maps to domain search input
 * - httpToDomainDestinationCreate sets required domain defaults and slug generation
 * - httpToDomainDestinationUpdate passes only provided fields
 */
import { describe, expect, it } from 'vitest';
import {
    DestinationSearchHttpSchema,
    httpToDomainDestinationCreate,
    httpToDomainDestinationSearch,
    httpToDomainDestinationUpdate
} from '../../../src/entities/destination/destination.http.schema.js';
import { DestinationTypeEnum } from '../../../src/enums/destination-type.enum.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../../src/enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../../src/enums/visibility.enum.js';

// ---------------------------------------------------------------------------
// Valid UUIDs for testing
// ---------------------------------------------------------------------------

const DESTINATION_UUID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

// ---------------------------------------------------------------------------
// DestinationSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('DestinationSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = DestinationSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should coerce isFeatured from string "true" to boolean', () => {
        const result = DestinationSearchHttpSchema.safeParse({ isFeatured: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(true);
        }
    });

    it('should accept country code filter (2 chars)', () => {
        const result = DestinationSearchHttpSchema.safeParse({ country: 'AR' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.country).toBe('AR');
        }
    });

    it('should reject country code that is not exactly 2 chars', () => {
        const result = DestinationSearchHttpSchema.safeParse({ country: 'ARG' });
        expect(result.success).toBe(false);
    });

    it('should coerce latitude and longitude from strings to numbers', () => {
        const result = DestinationSearchHttpSchema.safeParse({
            latitude: '-32.5',
            longitude: '-58.2'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.latitude).toBe(-32.5);
            expect(result.data.longitude).toBe(-58.2);
        }
    });

    it('should reject latitude above 90', () => {
        const result = DestinationSearchHttpSchema.safeParse({ latitude: '91' });
        expect(result.success).toBe(false);
    });

    it('should coerce minRating from string to number', () => {
        const result = DestinationSearchHttpSchema.safeParse({ minRating: '4' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.minRating).toBe(4);
        }
    });

    it('should accept destinationType enum filter', () => {
        const result = DestinationSearchHttpSchema.safeParse({
            destinationType: DestinationTypeEnum.CITY
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destinationType).toBe(DestinationTypeEnum.CITY);
        }
    });

    it('should accept searchScope filter', () => {
        const result = DestinationSearchHttpSchema.safeParse({ searchScope: 'name' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.searchScope).toBe('name');
        }
    });

    it('should reject invalid searchScope', () => {
        const result = DestinationSearchHttpSchema.safeParse({ searchScope: 'invalid' });
        expect(result.success).toBe(false);
    });

    it('should accept tags as comma-separated string filter', () => {
        const result = DestinationSearchHttpSchema.safeParse({
            tags: 'beach,mountains'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.tags).toEqual(['beach', 'mountains']);
        }
    });

    it('should accept hasAttractions boolean coercion', () => {
        const result = DestinationSearchHttpSchema.safeParse({ hasAttractions: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasAttractions).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainDestinationSearch
// ---------------------------------------------------------------------------

describe('httpToDomainDestinationSearch', () => {
    it('should map pagination fields to domain search', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({ page: '2', pageSize: '15' });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(15);
    });

    it('should include isFeatured filter in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({ isFeatured: 'false' });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.isFeatured).toBe(false);
    });

    it('should include country and city filters in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({ country: 'AR', city: 'Concepcion' });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.country).toBe('AR');
        expect(result.city).toBe('Concepcion');
    });

    it('should include geographic filters in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({
            latitude: '-32.0',
            longitude: '-58.0',
            radius: '50'
        });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.latitude).toBe(-32.0);
        expect(result.longitude).toBe(-58.0);
        expect(result.radius).toBe(50);
    });

    it('should include minRating in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({ minRating: '3.5' });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.minRating).toBe(3.5);
    });

    it('should include tags in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({ tags: 'beach,family' });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.tags).toEqual(['beach', 'family']);
    });

    it('should include destinationType in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({
            destinationType: DestinationTypeEnum.PROVINCE
        });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.destinationType).toBe(DestinationTypeEnum.PROVINCE);
    });

    it('should forward searchScope to domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({ searchScope: 'name' });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.searchScope).toBe('name');
    });

    it('should include accommodation count range in domain output', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({
            minAccommodations: '5',
            maxAccommodations: '50'
        });

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.minAccommodations).toBe(5);
        expect(result.maxAccommodations).toBe(50);
    });

    it('should handle empty input with all-undefined domain fields', () => {
        // Arrange
        const parsed = DestinationSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainDestinationSearch(parsed);

        // Assert
        expect(result.isFeatured).toBeUndefined();
        expect(result.country).toBeUndefined();
        expect(result.destinationType).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainDestinationCreate
// ---------------------------------------------------------------------------

describe('httpToDomainDestinationCreate', () => {
    const baseCreatePayload = {
        name: 'Concepcion del Uruguay',
        summary: 'Beautiful city in Entre Rios',
        description:
            'A historic city on the shores of the Uruguay River with rich cultural heritage and natural beauty.',
        country: 'AR',
        isFeatured: false
    };

    it('should map required fields to domain create input', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.name).toBe('Concepcion del Uruguay');
        expect(result.summary).toBe('Beautiful city in Entre Rios');
        expect(result.description).toBe(
            'A historic city on the shores of the Uruguay River with rich cultural heritage and natural beauty.'
        );
    });

    it('should generate slug from name when slug not provided', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.slug).toMatch(/^concepcion-del-uruguay$/);
    });

    it('should use provided slug when given', () => {
        // Arrange
        const payload = { ...baseCreatePayload, slug: 'cdu-entre-rios' };

        // Act
        const result = httpToDomainDestinationCreate(payload);

        // Assert
        expect(result.slug).toBe('cdu-entre-rios');
    });

    it('should set lifecycleState to ACTIVE by default', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should set visibility to PUBLIC by default', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('should set moderationState to PENDING by default', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('should set initial counts to 0', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.accommodationsCount).toBe(0);
        expect(result.reviewsCount).toBe(0);
        expect(result.averageRating).toBe(0);
    });

    it('should default destinationType to CITY when not provided', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.destinationType).toBe(DestinationTypeEnum.CITY);
    });

    it('should use provided destinationType when given', () => {
        // Arrange
        const payload = { ...baseCreatePayload, destinationType: DestinationTypeEnum.REGION };

        // Act
        const result = httpToDomainDestinationCreate(payload);

        // Assert
        expect(result.destinationType).toBe(DestinationTypeEnum.REGION);
    });

    it('should default parentDestinationId to null', () => {
        // Act
        const result = httpToDomainDestinationCreate(baseCreatePayload);

        // Assert
        expect(result.parentDestinationId).toBeNull();
    });

    it('should set parentDestinationId when provided', () => {
        // Arrange
        const payload = { ...baseCreatePayload, parentDestinationId: DESTINATION_UUID };

        // Act
        const result = httpToDomainDestinationCreate(payload);

        // Assert
        expect(result.parentDestinationId).toBe(DESTINATION_UUID);
    });

    it('should build location when country is provided', () => {
        // Arrange
        const payload = {
            ...baseCreatePayload,
            country: 'AR',
            state: 'Entre Rios'
        };

        // Act
        const result = httpToDomainDestinationCreate(payload);

        // Assert
        expect(result.location).toBeDefined();
        expect(result.location?.country).toBe('AR');
        expect(result.location?.state).toBe('Entre Rios');
    });

    it('should include coordinates in location when lat/lon provided', () => {
        // Arrange
        const payload = {
            ...baseCreatePayload,
            latitude: -32.0,
            longitude: -58.0
        };

        // Act
        const result = httpToDomainDestinationCreate(payload);

        // Assert
        expect(result.location?.coordinates?.lat).toBe('-32');
        expect(result.location?.coordinates?.long).toBe('-58');
    });

    it('should pass isFeatured through from HTTP data', () => {
        // Arrange
        const payload = { ...baseCreatePayload, isFeatured: true };

        // Act
        const result = httpToDomainDestinationCreate(payload);

        // Assert
        expect(result.isFeatured).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainDestinationUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainDestinationUpdate', () => {
    it('should map name update to domain update input', () => {
        // Arrange
        const httpData = { name: 'Updated Name' };

        // Act
        const result = httpToDomainDestinationUpdate(httpData);

        // Assert
        expect(result.name).toBe('Updated Name');
    });

    it('should map slug update', () => {
        // Arrange
        const httpData = { slug: 'updated-slug' };

        // Act
        const result = httpToDomainDestinationUpdate(httpData);

        // Assert
        expect(result.slug).toBe('updated-slug');
    });

    it('should map summary update', () => {
        // Arrange
        const httpData = { summary: 'Updated summary text here' };

        // Act
        const result = httpToDomainDestinationUpdate(httpData);

        // Assert
        expect(result.summary).toBe('Updated summary text here');
    });

    it('should map isFeatured update', () => {
        // Arrange
        const httpData = { isFeatured: true };

        // Act
        const result = httpToDomainDestinationUpdate(httpData);

        // Assert
        expect(result.isFeatured).toBe(true);
    });

    it('should handle empty update payload', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainDestinationUpdate(httpData);

        // Assert
        expect(result.name).toBeUndefined();
        expect(result.slug).toBeUndefined();
        expect(result.summary).toBeUndefined();
        expect(result.description).toBeUndefined();
        expect(result.isFeatured).toBeUndefined();
    });
});
