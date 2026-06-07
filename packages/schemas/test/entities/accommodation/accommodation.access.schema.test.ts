/**
 * Tests for accommodation access schemas (public / protected / admin).
 *
 * Pins the SPEC-167 invariant: `archivedGallery` MUST be stripped from
 * the public and protected response schemas and MUST be present on the
 * admin schema (which uses the full entity type).
 *
 * @module test/entities/accommodation/accommodation.access.schema
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../../../src/entities/accommodation/accommodation.access.schema.js';

// ---------------------------------------------------------------------------
// Minimal entity fixture that includes archivedGallery in media
// ---------------------------------------------------------------------------

const archivedPhoto = {
    url: 'https://cdn.example.com/archived-1.jpg',
    moderationState: 'APPROVED' as const
};

const activePhoto = {
    url: 'https://cdn.example.com/active-1.jpg',
    moderationState: 'APPROVED' as const
};

/** Minimal accommodation payload that a service would return. */
const entityPayload = {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    slug: 'test-accommodation',
    name: 'Test Accommodation',
    type: 'HOTEL' as const,
    summary: 'A test summary for this accommodation.',
    description:
        'A sufficiently long description for this test accommodation to satisfy min length.',
    isFeatured: false,
    destinationId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    media: {
        gallery: [activePhoto],
        archivedGallery: [archivedPhoto]
    },
    location: {
        street: 'Test St',
        number: '1'
    },
    averageRating: 0,
    reviewsCount: 0,
    visibility: 'PUBLIC' as const,
    seo: null,
    price: null,
    tags: [],
    extraInfo: null,
    // Additional fields needed for protected / admin schemas
    ownerId: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    contactInfo: { mobilePhone: '+15550123456' },
    lifecycleState: 'ACTIVE' as const,
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // Admin / full entity fields
    moderationState: 'APPROVED' as const,
    ownerSuspended: false,
    planRestricted: false,
    createdById: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    updatedById: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    deletedAt: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// SPEC-167 PIN: archivedGallery must not leak to public / protected consumers
// ---------------------------------------------------------------------------

describe('AccommodationPublicSchema — archivedGallery strip (SPEC-167)', () => {
    it('strips archivedGallery from media when parsing an entity payload', () => {
        const result = AccommodationPublicSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                (result.data.media as Record<string, unknown> | null | undefined)?.archivedGallery
            ).toBeUndefined();
        }
    });

    it('preserves active gallery photos after stripping archivedGallery', () => {
        const result = AccommodationPublicSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.media?.gallery).toHaveLength(1);
            expect(result.data.media?.gallery?.[0]?.url).toBe(activePhoto.url);
        }
    });
});

describe('AccommodationProtectedSchema — archivedGallery strip (SPEC-167)', () => {
    it('strips archivedGallery from media when parsing an entity payload', () => {
        const result = AccommodationProtectedSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                (result.data.media as Record<string, unknown> | null | undefined)?.archivedGallery
            ).toBeUndefined();
        }
    });

    it('preserves active gallery photos after stripping archivedGallery', () => {
        const result = AccommodationProtectedSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.media?.gallery).toHaveLength(1);
            expect(result.data.media?.gallery?.[0]?.url).toBe(activePhoto.url);
        }
    });
});

describe('AccommodationAdminSchema — archivedGallery preserved (SPEC-167)', () => {
    it('retains archivedGallery in media (admin consumers may need it for restore ops)', () => {
        const result = AccommodationAdminSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                (result.data.media as Record<string, unknown> | null | undefined)?.archivedGallery
            ).toBeDefined();
            expect(
                (result.data.media as { archivedGallery?: Array<unknown> } | null | undefined)
                    ?.archivedGallery
            ).toHaveLength(1);
        }
    });
});
