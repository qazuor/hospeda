/**
 * H-118 — public accommodation contactInfo exposure.
 *
 * Route-level regression: mounts the REAL `publicGetAccommodationBySlugRoute`
 * (built with the real `createPublicRoute` factory, so the real response
 * schema strip — `stripWithSchema` against `AccommodationPublicSchema` —
 * actually runs), not a route-factory stub. Only the service and the raw
 * `@repo/db` reads the handler performs directly (owner/amenities/features/
 * faqs) are mocked, mirroring `getBySlug.rich-description.test.ts`.
 *
 * What this pins:
 * - `contactInfo.mobilePhone` / `.personalEmail` / `.website` survive the
 *   public strip — these are the three fields the owner decided to publish
 *   (H-118, 16/08).
 * - Every OTHER `contactInfo` sub-field is stripped, even when populated on
 *   the stored row: `workEmail`, `homePhone`, `workPhone`,
 *   `preferredEmail`, `preferredPhone` (never collected by the public
 *   contact form) and, most importantly, `whatsapp` — which has its own
 *   dedicated, per-viewer-entitlement-gated channel (`hasWhatsapp` +
 *   `GET /protected/accommodations/:id/whatsapp`, HOS-19). A regression that
 *   widens the public contactInfo schema back to the full read shape would
 *   silently bypass that gate for every accommodation; this test fails loudly
 *   if that happens.
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
        amenities: { id: 'amenities.id', name: 'amenities.name', icon: 'amenities.icon' },
        features: { id: 'features.id', name: 'features.name', icon: 'features.icon' },
        rAccommodationAmenity: {
            amenityId: 'raa.amenityId',
            isOptional: 'raa.isOptional',
            additionalCost: 'raa.additionalCost',
            accommodationId: 'raa.accommodationId'
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

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    ownerEntitlementMiddleware: vi.fn(),
    resolveOwnerEntitlementsForOwnerId: mockResolveOwnerEntitlementsForOwnerId
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
    visibility: 'PUBLIC',
    moderationState: 'APPROVED',
    lifecycleState: 'ACTIVE',
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

describe('publicGetAccommodationBySlugRoute — contactInfo public exposure (H-118)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue([]);
        // owner, amenities, features, faqs = empty (getBySlug re-fetches these
        // directly via getDb(), independent of what the service returned)
        queueSelectResults([], [], [], []);
    });

    it('exposes only mobilePhone/personalEmail/website out of a fully-populated contactInfo', async () => {
        mockGetBySlug.mockResolvedValue({ data: ACCOMMODATION_WITH_FULL_CONTACT_INFO });

        const app = await buildApp();
        const res = await app.request('/slug/hotel-test-contact-info');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { data: { contactInfo?: Record<string, unknown> } };
        expect(body.data.contactInfo).toEqual({
            mobilePhone: '+5493431234567',
            personalEmail: 'contacto@hospeda-test.com.ar',
            website: 'https://hospeda-test.com.ar'
        });
    });

    it('strips whatsapp specifically — it has its own entitlement-gated channel (HOS-19)', async () => {
        mockGetBySlug.mockResolvedValue({ data: ACCOMMODATION_WITH_FULL_CONTACT_INFO });

        const app = await buildApp();
        const res = await app.request('/slug/hotel-test-contact-info');
        const body = (await res.json()) as { data: { contactInfo?: Record<string, unknown> } };

        expect(body.data.contactInfo).not.toHaveProperty('whatsapp');
    });

    it('strips workEmail/homePhone/workPhone/preferredEmail/preferredPhone', async () => {
        mockGetBySlug.mockResolvedValue({ data: ACCOMMODATION_WITH_FULL_CONTACT_INFO });

        const app = await buildApp();
        const res = await app.request('/slug/hotel-test-contact-info');
        const body = (await res.json()) as { data: { contactInfo?: Record<string, unknown> } };

        expect(body.data.contactInfo).not.toHaveProperty('workEmail');
        expect(body.data.contactInfo).not.toHaveProperty('homePhone');
        expect(body.data.contactInfo).not.toHaveProperty('workPhone');
        expect(body.data.contactInfo).not.toHaveProperty('preferredEmail');
        expect(body.data.contactInfo).not.toHaveProperty('preferredPhone');
    });

    it('omits contactInfo entirely when the accommodation has none', async () => {
        mockGetBySlug.mockResolvedValue({
            data: { ...ACCOMMODATION_WITH_FULL_CONTACT_INFO, contactInfo: null }
        });

        const app = await buildApp();
        const res = await app.request('/slug/hotel-test-contact-info');
        const body = (await res.json()) as { data: { contactInfo?: unknown } };

        expect(body.data.contactInfo == null).toBe(true);
    });
});
