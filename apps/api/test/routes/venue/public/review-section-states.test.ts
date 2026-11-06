/**
 * @file review-section-states.test.ts
 * @description HOS-1866 / 6.6 (AC:6:10) — the public `getBySlug` response must
 * publish `reviewSectionStates` for the sections a review dimension is bound
 * to, must collapse `locked` to `available`, and must drop a dimension whose
 * section is `absent` from the persisted aggregate.
 *
 * This test reads the HTTP response, not the projector's return value: that is
 * the point. `VenuePublicSchema` is the route's `responseSchema`, so a field
 * missing from its `.pick`/`.extend` is silently discarded and only an
 * end-to-end assertion catches it.
 */
import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { venueSvc, menu, events, specials, effectiveSet } = vi.hoisted(() => ({
    venueSvc: { getBySlug: vi.fn() },
    menu: vi.fn(),
    events: vi.fn(),
    specials: vi.fn(),
    effectiveSet: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        VenueService: vi.fn().mockImplementation(function () {
            return {
                getBySlug: (...args: unknown[]) => venueSvc.getBySlug(...args),
                model: {}
            };
        }),
        getVenueMenu: menu,
        getVenueEvents: events,
        getVenueDailySpecials: specials
    };
});

vi.mock('../../../../src/utils/listing-catalog-relations', () => ({
    fetchVenueAmenities: vi.fn(async () => []),
    fetchVenueFeatures: vi.fn(async () => [])
}));

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet })
}));

import { initApp } from '../../../../src/app';
import type { AppOpenAPI } from '../../../../src/types';
import { validateApiEnv } from '../../../../src/utils/env';

const PUBLIC_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest'
};

const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000001866';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000001866';
const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000001866';

/** A persisted aggregate with food + service (food survives from an old type). */
const RATING = {
    food: { average: 5, count: 1 },
    service: { average: 4, count: 2 }
} as const;

type VenueOverrides = {
    readonly slug: string;
    readonly type: string;
    readonly businessLines: readonly string[];
    readonly rating?: unknown;
};

/**
 * The minimum a public venue row must carry to survive `VenuePublicSchema`.
 * `businessLines` is not in the response schema; it is read by the resolver
 * before projection, exactly as the real service row provides it.
 */
function makeVenue({
    slug,
    type,
    businessLines,
    rating = RATING
}: VenueOverrides): Record<string, unknown> {
    return {
        id: VENUE_ID,
        ownerId: OWNER_ID,
        slug,
        name: 'Test venue',
        type,
        businessLines,
        rating,
        summary: 'A test venue.',
        description: 'A detailed test description for this venue listing.',
        destinationId: DESTINATION_ID,
        publicationStatus: 'PUBLISHED',
        averageRating: 4.5,
        reviewsCount: 2,
        isFeatured: false,
        featuredByEntitlement: false,
        media: null,
        seo: null,
        socialNetworks: null,
        nameI18n: null,
        summaryI18n: null,
        descriptionI18n: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        createdById: null,
        updatedById: null
    };
}

/** Grants `manage_venue_menu` to the owner so the `menu` section is `available`. */
function grantMenu(granted: boolean): void {
    effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: vertical as VerticalEnum,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: granted ? [{ key: 'manage_venue_menu', value: 1, strategy: 'MAX' }] : []
            })
    );
}

let app: AppOpenAPI;

/** Reads the `data` envelope of the public route. */
async function getVenue(slug: string): Promise<Record<string, unknown>> {
    const res = await app.request(`/api/v1/public/venues/slug/${slug}`, {
        headers: PUBLIC_HEADERS
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    return body.data;
}

beforeEach(async () => {
    vi.clearAllMocks();
    menu.mockResolvedValue({ data: { sections: [] }, error: null });
    events.mockResolvedValue({ data: { events: [] }, error: null });
    specials.mockResolvedValue({ data: { specials: [] }, error: null });
    grantMenu(false);
    validateApiEnv();
    app = await initApp();
});

describe('GET /public/venues/slug/:slug — reviewSectionStates (HOS-1866)', () => {
    it('TEST:6.6:5 publishes the bound section as absent for a nightclub', async () => {
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({ slug: 'boliche', type: 'BOLICHE', businessLines: ['nightlife'] })
        });

        const data = await getVenue('boliche');

        expect(data.reviewSectionStates).toEqual({ menu: { state: 'absent' } });
    });

    it('TEST:6.6:5 collapses a locked menu to available for an unentitled restaurant', async () => {
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({ slug: 'restaurant', type: 'RESTAURANT', businessLines: ['food'] })
        });

        const data = await getVenue('restaurant');

        expect(data.reviewSectionStates).toEqual({ menu: { state: 'available' } });
    });

    it('TEST:6.6:5 publishes a granted menu as available', async () => {
        grantMenu(true);
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({ slug: 'restaurant', type: 'RESTAURANT', businessLines: ['food'] })
        });

        const data = await getVenue('restaurant');

        expect(data.reviewSectionStates).toEqual({ menu: { state: 'available' } });
    });

    it('TEST:6.6:5 drops a stored food aggregate when the section is absent', async () => {
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({ slug: 'boliche', type: 'BOLICHE', businessLines: ['nightlife'] })
        });

        const data = await getVenue('boliche');

        const rating = data.rating as Record<string, unknown>;
        expect(rating).not.toHaveProperty('food');
        expect(rating.service).toEqual({ average: 4, count: 2 });
    });
});
