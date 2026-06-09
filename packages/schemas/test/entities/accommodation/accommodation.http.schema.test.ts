/**
 * Tests for accommodation HTTP schemas.
 *
 * Verifies:
 * - socialNetworks flat fields parse and convert correctly
 * - contactInfo flat fields parse and convert correctly
 * - converters produce valid domain types
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationCreateHttpSchema,
    AccommodationUpdateHttpSchema,
    httpToDomainAccommodationCreate,
    httpToDomainAccommodationUpdate
} from '../../../src/entities/accommodation/accommodation.http.schema.js';
import { AccommodationTypeEnum, PriceCurrencyEnum } from '../../../src/enums/index.js';

// ---------------------------------------------------------------------------
// Minimal valid create payload (base required fields only)
// ---------------------------------------------------------------------------

const baseCreatePayload = {
    name: 'Test Hotel',
    description: 'A detailed description for the test hotel that is long enough.',
    type: AccommodationTypeEnum.HOTEL,
    address: '123 Main St',
    latitude: -32.0,
    longitude: -58.0,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    basePrice: 100,
    currency: PriceCurrencyEnum.USD,
    isFeatured: false,
    isAvailable: true,
    allowsPets: false,
    destinationId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    ownerId: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f'
};

// ---------------------------------------------------------------------------
// socialNetworks — HTTP schema parsing
// ---------------------------------------------------------------------------

describe('AccommodationCreateHttpSchema — socialNetworks', () => {
    it('should accept flat social network fields', () => {
        const data = {
            ...baseCreatePayload,
            twitter: 'https://twitter.com/test',
            facebook: 'https://facebook.com/test',
            instagram: 'https://instagram.com/test',
            linkedin: 'https://linkedin.com/company/test',
            tiktok: 'https://tiktok.com/@test',
            youtube: 'https://youtube.com/@test'
        };

        const result = AccommodationCreateHttpSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('should accept partial social network fields', () => {
        const data = {
            ...baseCreatePayload,
            facebook: 'https://facebook.com/test'
        };

        const result = AccommodationCreateHttpSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('should accept no social network fields', () => {
        const result = AccommodationCreateHttpSchema.safeParse(baseCreatePayload);
        expect(result.success).toBe(true);
    });

    it('should reject invalid social network URLs', () => {
        const data = {
            ...baseCreatePayload,
            facebook: 'not-a-url'
        };

        const result = AccommodationCreateHttpSchema.safeParse(data);
        expect(result.success).toBe(false);
    });
});

describe('AccommodationUpdateHttpSchema — socialNetworks', () => {
    it('should accept flat social network fields in partial update', () => {
        const data = {
            twitter: 'https://twitter.com/test'
        };

        const result = AccommodationUpdateHttpSchema.safeParse(data);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// contactInfo — HTTP schema parsing
// ---------------------------------------------------------------------------

describe('AccommodationCreateHttpSchema — contactInfo', () => {
    it('should accept contact fields (phone, email, website)', () => {
        const data = {
            ...baseCreatePayload,
            phone: '+5493435551234',
            email: 'contact@test.com',
            website: 'https://test.com'
        };

        const result = AccommodationCreateHttpSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('should accept partial contact fields', () => {
        const data = {
            ...baseCreatePayload,
            phone: '+5493435551234'
        };

        const result = AccommodationCreateHttpSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('should accept no contact fields', () => {
        const result = AccommodationCreateHttpSchema.safeParse(baseCreatePayload);
        expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
        const data = {
            ...baseCreatePayload,
            email: 'not-an-email'
        };

        const result = AccommodationCreateHttpSchema.safeParse(data);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAccommodationCreate — socialNetworks conversion
// ---------------------------------------------------------------------------

describe('httpToDomainAccommodationCreate — socialNetworks', () => {
    it('should map flat social fields to nested socialNetworks object', () => {
        const httpData = {
            ...baseCreatePayload,
            twitter: 'https://twitter.com/test',
            facebook: 'https://facebook.com/test',
            instagram: 'https://instagram.com/test',
            linkedin: 'https://linkedin.com/company/test',
            tiktok: 'https://tiktok.com/@test',
            youtube: 'https://youtube.com/@test'
        };

        const result = httpToDomainAccommodationCreate(httpData);

        expect(result.socialNetworks).toEqual({
            twitter: 'https://twitter.com/test',
            facebook: 'https://facebook.com/test',
            instagram: 'https://instagram.com/test',
            linkedIn: 'https://linkedin.com/company/test',
            tiktok: 'https://tiktok.com/@test',
            youtube: 'https://youtube.com/@test'
        });
    });

    it('should set socialNetworks to undefined when no social fields provided', () => {
        const result = httpToDomainAccommodationCreate(baseCreatePayload);

        expect(result.socialNetworks).toBeUndefined();
    });

    it('should map partial social fields correctly', () => {
        const httpData = {
            ...baseCreatePayload,
            facebook: 'https://facebook.com/test',
            instagram: 'https://instagram.com/test'
        };

        const result = httpToDomainAccommodationCreate(httpData);

        expect(result.socialNetworks).toEqual({
            facebook: 'https://facebook.com/test',
            instagram: 'https://instagram.com/test'
        });
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAccommodationCreate — contactInfo conversion
// ---------------------------------------------------------------------------

describe('httpToDomainAccommodationCreate — contactInfo', () => {
    it('should map flat contact fields to nested contactInfo object', () => {
        const httpData = {
            ...baseCreatePayload,
            phone: '+5493435551234',
            email: 'contact@test.com',
            website: 'https://test.com'
        };

        const result = httpToDomainAccommodationCreate(httpData);

        expect(result.contactInfo).toEqual({
            mobilePhone: '+5493435551234',
            personalEmail: 'contact@test.com',
            website: 'https://test.com'
        });
    });

    it('should set contactInfo to undefined when no contact fields provided', () => {
        const result = httpToDomainAccommodationCreate(baseCreatePayload);

        expect(result.contactInfo).toBeUndefined();
    });

    it('should map phone to mobilePhone and email to personalEmail', () => {
        const httpData = {
            ...baseCreatePayload,
            phone: '+5493435551234',
            email: 'host@test.com'
        };

        const result = httpToDomainAccommodationCreate(httpData);

        expect(result.contactInfo?.mobilePhone).toBe('+5493435551234');
        expect(result.contactInfo?.personalEmail).toBe('host@test.com');
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAccommodationUpdate — socialNetworks conversion
// ---------------------------------------------------------------------------

describe('httpToDomainAccommodationUpdate — socialNetworks', () => {
    it('should map flat social fields to nested socialNetworks on update', () => {
        const httpData = {
            twitter: 'https://twitter.com/test',
            facebook: 'https://facebook.com/test'
        };

        const result = httpToDomainAccommodationUpdate(httpData);

        expect(result.socialNetworks).toEqual({
            twitter: 'https://twitter.com/test',
            facebook: 'https://facebook.com/test'
        });
    });

    it('should not include socialNetworks when no social fields provided', () => {
        const result = httpToDomainAccommodationUpdate({ name: 'Updated Hotel' });

        expect(result.socialNetworks).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAccommodationUpdate — contactInfo conversion
// ---------------------------------------------------------------------------

describe('httpToDomainAccommodationUpdate — contactInfo', () => {
    it('should map flat contact fields to nested contactInfo on update', () => {
        const httpData = {
            phone: '+5493435551234',
            email: 'contact@test.com',
            website: 'https://test.com'
        };

        const result = httpToDomainAccommodationUpdate(httpData);

        expect(result.contactInfo).toEqual({
            mobilePhone: '+5493435551234',
            personalEmail: 'contact@test.com',
            website: 'https://test.com'
        });
    });

    it('should not include contactInfo when no contact fields provided', () => {
        const result = httpToDomainAccommodationUpdate({ name: 'Updated Hotel' });

        expect(result.contactInfo).toBeUndefined();
    });

    it('should map phone to mobilePhone on update', () => {
        const httpData = {
            phone: '+5493435551234'
        };

        const result = httpToDomainAccommodationUpdate(httpData);

        expect(result.contactInfo?.mobilePhone).toBe('+5493435551234');
    });
});
