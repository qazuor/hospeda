/**
 * Analytics for POST /api/v1/protected/accommodations/:id/publish (HOS-2119, T-072):
 * the `accommodation_published` event carries the key properties and the visitor
 * IP/UA taken from the request headers. Mock strategy mirrors
 * `accommodation-protected-publish.test.ts`.
 *
 * @module test/routes/accommodation-protected-publish-analytics
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockPublish, mockGetById, mockCapture } = vi.hoisted(() => ({
    mockPublish: vi.fn(),
    mockGetById: vi.fn(),
    mockCapture: vi.fn()
}));

vi.mock('../../src/lib/analytics-client', async (importActual) => ({
    ...(await importActual<typeof import('../../src/lib/analytics-client')>()),
    captureServerAnalyticsEvent: (...args: unknown[]) => mockCapture(...args)
}));

vi.mock('../../src/services/listing-publication/listing-publication.service', () => ({
    ListingPublicationService: vi.fn().mockImplementation(function () {
        return { publish: mockPublish };
    })
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                publish: mockPublish,
                getById: mockGetById
            };
        })
    };
});

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId: ACTOR_ID, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: ACTOR_ID
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'activate_trial', value: 1, strategy: 'MAX' }]
            })
    })
}));

// Actor: HOST owner — ownerId will match actor.id in the accommodation stub.
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mockActor = {
    id: ACTOR_ID,
    roles: ['HOST'],
    permissions: ['accommodation.update.own', 'access.panelProtected']
};
vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return {
        ...actual,
        getActorFromContext: () => mockActor
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks are set up
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/publish`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

// Accommodation stub: ownerId matches actor.id → ownership gate passes.
const ACCOMMODATION_STUB = {
    id: ACCOMMODATION_ID,
    ownerId: ACTOR_ID
};

const PUBLISHED_ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    slug: 'test-accommodation',
    name: 'Test Accommodation',
    type: 'HOTEL',
    summary: 'A lovely place to stay for your trip.',
    description:
        'A long-enough description of this lovely accommodation, well over thirty characters.',
    isFeatured: false,
    destinationId: '11111111-1111-4111-8111-111111111111',
    media: null,
    location: { city: 'Test City', country: 'Test Country' },
    averageRating: 0,
    reviewsCount: 0,
    publicationStatus: 'PUBLISHED',
    seo: undefined,
    price: { price: 100, currency: 'USD' },
    tags: [],
    extraInfo: undefined,
    ownerId: ACTOR_ID,
    contactInfo: undefined,
    socialNetworks: undefined,
    faqs: [],
    createdAt: NOW,
    updatedAt: NOW
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /:id/publish analytics (HOS-2119 T-072)', () => {
    let app: AppOpenAPI;
    const baseHeaders = { Authorization: ['Bearer', 'test-protected-token'].join(' ') };

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockGetById.mockResolvedValue({ data: ACCOMMODATION_STUB, error: undefined });
        mockPublish.mockResolvedValue(PUBLISHED_ACCOMMODATION);
    });

    it('captures accommodation_published with key properties and the request visitor', async () => {
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: { ...baseHeaders, 'user-agent': 'UA/1', 'cf-connecting-ip': '203.0.113.7' }
        });

        expect(res.status).toBe(201);
        expect(mockCapture).toHaveBeenCalledTimes(1);
        expect(mockCapture).toHaveBeenCalledWith({
            distinctId: ACTOR_ID,
            name: 'accommodation_published',
            properties: {
                accommodation_id: ACCOMMODATION_ID,
                accommodation_type: 'HOTEL',
                destination_id: '11111111-1111-4111-8111-111111111111',
                owner_id: ACTOR_ID
            },
            visitor: { ip: '203.0.113.7', userAgent: 'UA/1' }
        });
    });

    it('omits the visitor when the ip header is absent', async () => {
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: { ...baseHeaders, 'user-agent': 'UA/1' }
        });

        expect(res.status).toBe(201);
        expect(mockCapture).toHaveBeenCalledTimes(1);
        expect(mockCapture.mock.calls[0]?.[0]).not.toHaveProperty('visitor');
    });
});
