/**
 * HOS-2258 AC-3: every public venue read withholds the linked videos, both the
 * top-level `videos` and the nested `media.videos`, unless the OWNER's plan
 * grants `can_embed_video`. The owner's description is never rewritten (AC-12).
 */

import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const OWNER_PAID = 'eeeeeeee-0000-4000-8000-000000001792';
const OWNER_FREE = 'eeeeeeee-0000-4000-8000-000000001793';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000001792';
const DEST_ID = 'dddddddd-0000-4000-8000-000000001792';
const VIDEOS = [{ url: 'https://youtu.be/dQw4w9WgXcQ', moderationState: 'APPROVED' }];
const DESCRIPTION = 'Pizzas, mirá https://youtu.be/dQw4w9WgXcQ';

const mockGetById = vi.fn();
const mockGetBySlug = vi.fn();
const mockSearch = vi.fn();
const mockReadEffectiveSet = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getVenueMenu: vi.fn(async () => ({
            data: { sections: [{ id: 'section', items: [] }] },
            error: null
        })),
        getVenueEvents: vi.fn(async () => ({ data: { events: [] }, error: null })),
        getVenueDailySpecials: vi.fn(async () => ({ data: { specials: [] }, error: null })),
        VenueService: vi.fn().mockImplementation(function () {
            return {
                getById: mockGetById,
                getBySlug: mockGetBySlug,
                search: mockSearch,
                model: {}
            };
        })
    };
});

vi.mock('../../../../src/utils/listing-catalog-relations', () => ({
    fetchVenueAmenities: vi.fn(async () => []),
    fetchVenueFeatures: vi.fn(async () => [])
}));

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mockReadEffectiveSet })
}));

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => ({ id: 'x', roles: ['GUEST'], permissions: [] }))
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/utils/route-factory', () => {
    const build = (options: {
        method: 'get';
        path: string;
        handler: (
            c: unknown,
            p: Record<string, unknown>,
            b: unknown,
            q: Record<string, unknown>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        app[options.method](options.path.replace(/\{([^}]+)\}/g, ':$1'), async (c) =>
            c.json({
                data: await options.handler(c, c.req.param(), undefined, c.req.query())
            })
        );
        return app;
    };
    return { createPublicRoute: build, createPublicListRoute: build };
});

function makeVenue(ownerId: string, businessLines: string[] = ['food']): Record<string, unknown> {
    return {
        id: VENUE_ID,
        ownerId,
        businessLines,
        description: DESCRIPTION,
        videos: VIDEOS,
        media: { featuredImage: { url: 'https://img.example/1.jpg' }, gallery: [], videos: VIDEOS },
        rating: { food: { average: 4, count: 2 }, service: { average: 5, count: 1 } },
        featuredByEntitlement: false,
        isFeatured: false
    };
}

/** Grants `can_embed_video` to OWNER_PAID only. */
function grantToPaidOwnerOnly(): void {
    mockReadEffectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: string }) => ({
            ...rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: vertical as VerticalEnum,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries:
                    userId === OWNER_PAID
                        ? [{ key: 'can_embed_video', value: 1, strategy: 'MAX' }]
                        : []
            })
        })
    );
}

async function get(target: readonly [string, string], url: string) {
    const res = await getResponse(target, url);
    expect(res.status).toBe(200);
    return (await res.json()).data;
}

async function getResponse(target: readonly [string, string], url: string) {
    const [modulePath, exportName] = target;
    vi.resetModules();
    const mod = (await import(modulePath)) as Record<string, Hono<AppBindings>>;
    const app = new Hono<AppBindings>();
    app.route('/', mod[exportName] as Hono<AppBindings>);
    const res = await app.request(url);
    return res;
}

const BY_ID = ['../../../../src/routes/venue/public/getById', 'publicGetVenueByIdRoute'] as const;
const BY_SLUG = [
    '../../../../src/routes/venue/public/getBySlug',
    'publicGetVenueBySlugRoute'
] as const;
const LIST = ['../../../../src/routes/venue/public/list', 'publicListVenuesRoute'] as const;
const BY_DEST = [
    '../../../../src/routes/venue/public/getByDestination',
    'publicGetVenuesByDestinationRoute'
] as const;

const CASES = [
    ['getById', BY_ID, `/${VENUE_ID}`],
    ['getBySlug', BY_SLUG, '/slug/test-venue'],
    ['list', LIST, '/'],
    ['getByDestination', BY_DEST, `/destination/${DEST_ID}`]
] as const;

function arrange(ownerId: string): void {
    const venue = makeVenue(ownerId);
    mockGetById.mockResolvedValue({ data: venue, error: null });
    mockGetBySlug.mockResolvedValue({ data: venue, error: null });
    mockSearch.mockResolvedValue({ data: { items: [venue], total: 1 }, error: null });
}

describe('HOS-2258 public venue videos gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        grantToPaidOwnerOnly();
    });

    it.each(
        CASES
    )('%s publishes no videos (top-level absent, media.videos empty) without the entitlement', async (_n, target, url) => {
        arrange(OWNER_FREE);
        const data = await get(target, url);
        const venue = 'items' in data ? data.items[0] : data;
        expect(venue).not.toHaveProperty('videos');
        expect(venue.media.videos).toEqual([]);
        expect(venue.media).toHaveProperty('featuredImage');
        expect(venue.description).toBe(DESCRIPTION);
    });

    it.each(CASES)('%s publishes both copies with the entitlement', async (_n, target, url) => {
        arrange(OWNER_PAID);
        const data = await get(target, url);
        const venue = 'items' in data ? data.items[0] : data;
        expect(venue.videos).toEqual(VIDEOS);
        expect(venue.media.videos).toEqual(VIDEOS);
    });

    it('hides the videos when the entitlement lookup fails closed', async () => {
        mockReadEffectiveSet.mockRejectedValue(new Error('billing unavailable'));
        arrange(OWNER_PAID);
        const data = await get(BY_ID, `/${VENUE_ID}`);
        expect(data).not.toHaveProperty('videos');
        expect(data.media.videos).toEqual([]);
    });
});
