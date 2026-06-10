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

// ---------------------------------------------------------------------------
// SPEC-208: summary, amenityIds, featureIds, media fields (new)
// ---------------------------------------------------------------------------

// Valid UUID v4 strings for SPEC-208 tests (Zod v4 requires version nibble in [1-8])
const AMENITY_UUID_1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const AMENITY_UUID_2 = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';
const FEATURE_UUID_1 = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3';

describe('AccommodationUpdateHttpSchema — summary, amenityIds, featureIds, media (SPEC-208)', () => {
    it('should accept summary field in update schema', () => {
        const result = AccommodationUpdateHttpSchema.safeParse({
            summary: 'A short but valid summary here'
        });
        expect(result.success).toBe(true);
    });

    it('should accept amenityIds array in update schema', () => {
        const result = AccommodationUpdateHttpSchema.safeParse({
            amenityIds: [AMENITY_UUID_1, AMENITY_UUID_2]
        });
        expect(result.success).toBe(true);
    });

    it('should reject amenityIds with non-uuid strings', () => {
        const result = AccommodationUpdateHttpSchema.safeParse({
            amenityIds: ['not-a-uuid']
        });
        expect(result.success).toBe(false);
    });

    it('should accept featureIds array in update schema', () => {
        const result = AccommodationUpdateHttpSchema.safeParse({
            featureIds: [FEATURE_UUID_1]
        });
        expect(result.success).toBe(true);
    });

    it('should accept media with featuredImage and gallery in update schema', () => {
        const result = AccommodationUpdateHttpSchema.safeParse({
            media: {
                featuredImage: { url: 'https://example.com/img.jpg' },
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg', moderationState: 'APPROVED' }
                ]
            }
        });
        expect(result.success).toBe(true);
    });

    it('should accept media without moderationState on images', () => {
        // Client sends images without moderationState — converter supplies APPROVED default
        const result = AccommodationUpdateHttpSchema.safeParse({
            media: {
                featuredImage: { url: 'https://example.com/img.jpg' }
            }
        });
        expect(result.success).toBe(true);
    });
});

describe('AccommodationCreateHttpSchema — summary, amenityIds, featureIds, media (SPEC-208)', () => {
    it('should accept amenityIds array in create schema', () => {
        const result = AccommodationCreateHttpSchema.safeParse({
            ...baseCreatePayload,
            amenityIds: [AMENITY_UUID_1]
        });
        expect(result.success).toBe(true);
    });

    it('should accept featureIds array in create schema', () => {
        const result = AccommodationCreateHttpSchema.safeParse({
            ...baseCreatePayload,
            featureIds: [FEATURE_UUID_1]
        });
        expect(result.success).toBe(true);
    });

    it('should accept media with featuredImage in create schema', () => {
        const result = AccommodationCreateHttpSchema.safeParse({
            ...baseCreatePayload,
            media: {
                featuredImage: { url: 'https://example.com/img.jpg' },
                gallery: []
            }
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// SPEC-208: httpToDomainAccommodationUpdate — summary, amenityIds, featureIds, media
// ---------------------------------------------------------------------------

describe('httpToDomainAccommodationUpdate — summary field (SPEC-208)', () => {
    it('should pass summary through to domain', () => {
        const result = httpToDomainAccommodationUpdate({ summary: 'Great place to stay' });
        expect(result.summary).toBe('Great place to stay');
    });

    it('should leave summary undefined when not provided', () => {
        const result = httpToDomainAccommodationUpdate({ name: 'Hotel' });
        expect(result.summary).toBeUndefined();
    });
});

describe('httpToDomainAccommodationUpdate — amenityIds, featureIds (SPEC-208)', () => {
    it('should pass amenityIds through to domain', () => {
        const ids = [AMENITY_UUID_1, AMENITY_UUID_2];
        const result = httpToDomainAccommodationUpdate({ amenityIds: ids });
        expect(result.amenityIds).toEqual(ids);
    });

    it('should leave amenityIds undefined when not provided', () => {
        const result = httpToDomainAccommodationUpdate({ name: 'Hotel' });
        expect(result.amenityIds).toBeUndefined();
    });

    it('should pass featureIds through to domain', () => {
        const ids = [FEATURE_UUID_1];
        const result = httpToDomainAccommodationUpdate({ featureIds: ids });
        expect(result.featureIds).toEqual(ids);
    });
});

describe('httpToDomainAccommodationUpdate — media conversion with APPROVED default (SPEC-208)', () => {
    it('should apply moderationState APPROVED when image has no moderationState', () => {
        const result = httpToDomainAccommodationUpdate({
            media: {
                featuredImage: { url: 'https://example.com/hero.jpg' }
            }
        });

        const media = result.media as
            | { featuredImage?: { url: string; moderationState: string } }
            | undefined;
        expect(media?.featuredImage?.url).toBe('https://example.com/hero.jpg');
        expect(media?.featuredImage?.moderationState).toBe('APPROVED');
    });

    it('should preserve client-supplied moderationState when present', () => {
        const result = httpToDomainAccommodationUpdate({
            media: {
                featuredImage: { url: 'https://example.com/hero.jpg', moderationState: 'PENDING' }
            }
        });

        const media = result.media as
            | { featuredImage?: { url: string; moderationState: string } }
            | undefined;
        expect(media?.featuredImage?.moderationState).toBe('PENDING');
    });

    it('should apply APPROVED default to gallery items without moderationState', () => {
        const result = httpToDomainAccommodationUpdate({
            media: {
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg', moderationState: 'APPROVED' }
                ]
            }
        });

        const media = result.media as
            | {
                  gallery?: Array<{ url: string; moderationState: string }>;
              }
            | undefined;
        const gallery = media?.gallery ?? [];
        expect(gallery[0]?.moderationState).toBe('APPROVED');
        expect(gallery[1]?.moderationState).toBe('APPROVED');
    });

    it('should leave media undefined when not provided', () => {
        const result = httpToDomainAccommodationUpdate({ name: 'Hotel' });
        expect(result.media).toBeUndefined();
    });

    it('should handle null media', () => {
        const result = httpToDomainAccommodationUpdate({ media: null });
        expect(result.media).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Fix 1 regression (SPEC-208 review): null featuredImage must clear the field
// ---------------------------------------------------------------------------

describe('httpToDomainAccommodationUpdate — null featuredImage clears field (SPEC-208 fix 1)', () => {
    it('should produce featuredImage === null (not undefined) when client sends null', () => {
        const result = httpToDomainAccommodationUpdate({
            media: {
                featuredImage: null,
                gallery: [{ url: 'https://x.test/y.jpg' }]
            }
        });

        const media = result.media as
            | {
                  featuredImage: null | undefined;
                  gallery: Array<{ url: string; moderationState: string }>;
              }
            | null
            | undefined;
        // Must be strictly null — undefined would mean "no change", null means "clear"
        expect(media?.featuredImage).toBeNull();
        expect(media?.gallery).toHaveLength(1);
        expect(media?.gallery?.[0]?.moderationState).toBe('APPROVED');
    });

    it('should preserve client-supplied moderationState PENDING in gallery items', () => {
        const result = httpToDomainAccommodationUpdate({
            media: {
                featuredImage: null,
                gallery: [
                    { url: 'https://x.test/y.jpg', moderationState: 'PENDING' },
                    { url: 'https://x.test/z.jpg' }
                ]
            }
        });

        const media = result.media as
            | {
                  featuredImage: null | undefined;
                  gallery: Array<{ url: string; moderationState: string }>;
              }
            | null
            | undefined;
        expect(media?.featuredImage).toBeNull();
        // PENDING is preserved on the first item
        expect(media?.gallery?.[0]?.moderationState).toBe('PENDING');
        // APPROVED is defaulted on the second item
        expect(media?.gallery?.[1]?.moderationState).toBe('APPROVED');
    });
});
