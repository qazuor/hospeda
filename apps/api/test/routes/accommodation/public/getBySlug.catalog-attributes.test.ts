/**
 * HOS-2058 -- the public accommodation detail carries the catalog model
 * attributes the grids render: `scope` / `availability` on each amenity
 * relation (badges, only when declared) and `category` on each feature
 * (grouping).
 *
 * Mounts the REAL `publicGetAccommodationBySlugRoute` so the public response
 * strip (`AccommodationPublicSchema`) runs; only the service and the raw
 * `@repo/db` reads are mocked (same harness as `getBySlug.contact-info.test.ts`).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const mockGetBySlug = vi.fn();
const mockResolveOwnerEntitlementsForOwnerId = vi.fn();
const mockSelect = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                getBySlug: mockGetBySlug
            };
        }),
        ServiceError: class ServiceError extends Error {
            public readonly code: string;

            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockSelect
        })),
        accommodationFaqs: {
            id: 'faq.id',
            question: 'faq.question',
            answer: 'faq.answer',
            category: 'faq.category',
            accommodationId: 'faq.accommodationId',
            lifecycleState: 'faq.lifecycleState',
            deletedAt: 'faq.deletedAt'
        },
        amenities: { id: 'amenities.id', slug: 'amenities.slug', icon: 'amenities.icon' },
        features: {
            id: 'features.id',
            slug: 'features.slug',
            icon: 'features.icon',
            category: 'features.category'
        },
        rAccommodationAmenity: {
            amenityId: 'raa.amenityId',
            isOptional: 'raa.isOptional',
            additionalCost: 'raa.additionalCost',
            accommodationId: 'raa.accommodationId',
            scope: 'raa.scope',
            availability: 'raa.availability'
        },
        rAccommodationFeature: {
            featureId: 'raf.featureId',
            hostReWriteName: 'raf.hostReWriteName',
            comments: 'raf.comments',
            accommodationId: 'raf.accommodationId'
        },
        users: {
            id: 'users.id',
            displayName: 'users.displayName',
            firstName: 'users.firstName',
            lastName: 'users.lastName',
            image: 'users.image',
            profile: 'users.profile',
            createdAt: 'users.createdAt'
        }
    };
});

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => ({
            id: '00000000-0000-4000-8000-000000000000',
            roles: ['GUEST'],
            permissions: []
        }))
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

function queueSelectResults(...rowsByCall: unknown[][]) {
    mockSelect.mockImplementation(function () {
        const rows = rowsByCall.shift() ?? [];
        const result = [...rows] as unknown[] & { limit?: (n: number) => Promise<unknown[]> };
        result.limit = vi.fn().mockResolvedValue(rows);
        const chain = {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnValue(result)
        };
        return chain;
    });
}

/** Mounts the REAL route (built by the real `createPublicRoute` factory). */
async function buildApp() {
    vi.resetModules();
    const { publicGetAccommodationBySlugRoute } = await import(
        '../../../../src/routes/accommodation/public/getBySlug'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetAccommodationBySlugRoute);
    return app;
}

/** Valid UUID for the fixture entity. */
const VALID_UUID = 'aaaaaaaa-0000-4000-8000-000000000118';

/** Reusable media object that satisfies the image schema (moderationState is required). */
const VALID_MEDIA = {
    featuredImage: {
        url: 'https://example.com/image.jpg',
        moderationState: 'APPROVED'
    }
};

/** Reusable SEO object (title min 30, description min 70). */
const VALID_SEO = {
    title: 'Hotel Test Accommodation SEO Title',
    description:
        'This is a long SEO description for the hotel test accommodation. It must be at least 70 characters long.'
};

/**
 * A full, schema-valid accommodation row whose `contactInfo` populates EVERY
 * sub-field — public-safe ones and non-public ones alike — so the assertions
 * below can prove the strip is selective, not "everything happens to be
 * empty".
 */
const ACCOMMODATION_WITH_FULL_CONTACT_INFO = {
    id: VALID_UUID,
    slug: 'hotel-test-contact-info',
    name: 'Hotel Test Contact Info',
    type: 'HOTEL',
    summary: 'A test accommodation for the H-118 contactInfo exposure test.',
    description:
        'This is a long enough description for schema validation. It needs to pass the minimum character requirements set in the Zod schema.',
    isFeatured: false,
    ownerId: 'bbbbbbbb-0000-4000-8000-000000000118',
    destinationId: 'cccccccc-0000-4000-8000-000000000118',
    media: VALID_MEDIA,
    location: { street: 'Av. Costanera', number: '123' },
    averageRating: 4.5,
    reviewsCount: 42,
    publicationStatus: 'PUBLISHED',
    seo: VALID_SEO,
    price: { price: 150, currency: 'ARS' },
    tags: [],
    extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: 'bbbbbbbb-0000-4000-8000-000000000118',
    updatedById: 'bbbbbbbb-0000-4000-8000-000000000118',
    contactInfo: {
        // Public trio (H-118 owner decision).
        mobilePhone: '+5493431234567',
        personalEmail: 'contacto@hospeda-test.com.ar',
        website: 'https://hospeda-test.com.ar',
        // Never collected by the public contact form — must stay private.
        workEmail: 'trabajo@hospeda-test.com.ar',
        homePhone: '+5433421112233',
        workPhone: '+5433424445566',
        preferredEmail: 'WORK',
        preferredPhone: 'MOBILE',
        // Has its own dedicated, entitlement-gated public channel — must
        // NEVER ride this unauthenticated payload.
        whatsapp: '+5493439998877'
    }
};

describe('publicGetAccommodationBySlugRoute -- catalog attributes (HOS-2058)', () => {
    const AMENITY_ID = 'dddddddd-0000-4000-8000-000000002058';
    const FEATURE_ID = 'eeeeeeee-0000-4000-8000-000000002058';

    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue([]);
        mockGetBySlug.mockResolvedValue({ data: ACCOMMODATION_WITH_FULL_CONTACT_INFO });
    });

    it('exposes declared scope/availability on amenities and category on features', async () => {
        // Arrange: owner, amenities, features, faqs (call order of the route).
        queueSelectResults(
            [],
            [
                {
                    amenityId: AMENITY_ID,
                    slug: 'pool',
                    icon: null,
                    isOptional: false,
                    additionalCost: null,
                    scope: 'shared',
                    availability: 'seasonal'
                }
            ],
            [
                {
                    featureId: FEATURE_ID,
                    slug: 'river_front',
                    icon: null,
                    category: 'LOCATION',
                    hostReWriteName: null,
                    comments: null
                }
            ],
            []
        );
        const app = await buildApp();

        // Act
        const res = await app.request('/slug/hotel-test-contact-info');

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: {
                amenities?: Array<Record<string, unknown>>;
                features?: Array<Record<string, unknown>>;
            };
        };
        expect(body.data.amenities?.[0]).toMatchObject({
            amenityId: AMENITY_ID,
            scope: 'shared',
            availability: 'seasonal'
        });
        expect(body.data.features?.[0]).toMatchObject({
            featureId: FEATURE_ID,
            category: 'LOCATION'
        });
    });

    it('keeps undeclared attributes as null, never inferring a value', async () => {
        queueSelectResults(
            [],
            [
                {
                    amenityId: AMENITY_ID,
                    slug: 'wifi',
                    icon: null,
                    isOptional: false,
                    additionalCost: null,
                    scope: null,
                    availability: null
                }
            ],
            [],
            []
        );
        const app = await buildApp();

        const res = await app.request('/slug/hotel-test-contact-info');

        const body = (await res.json()) as {
            data: { amenities?: Array<Record<string, unknown>> };
        };
        expect(body.data.amenities?.[0]?.scope).toBeNull();
        expect(body.data.amenities?.[0]?.availability).toBeNull();
    });
});
