/**
 * HOS-1792 regression: the public venue reads that return the stored row
 * (by-id, list, by-destination) must withhold `menuFileUrl` / `menuFileKind`
 * when the OWNER's plan does not grant `manage_venue_menu`, exactly as by-slug
 * does through `applyVenueMenuManagementGate`.
 */

import type { VerticalEnum } from '@repo/schemas';
import { getVenueDailySpecials, getVenueEvents } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const OWNER_PAID = 'eeeeeeee-0000-4000-8000-000000001792';
const OWNER_FREE = 'eeeeeeee-0000-4000-8000-000000001793';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000001792';
const DEST_ID = 'dddddddd-0000-4000-8000-000000001792';
const FILE_URL = 'https://res.cloudinary.com/x/menu.pdf';

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
        menuUrl: 'https://menu.example',
        menuFileUrl: FILE_URL,
        menuFileKind: 'PDF',
        featuredByEntitlement: false,
        isFeatured: false
    };
}

/** Grants `manage_venue_menu` to OWNER_PAID only. */
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
                        ? [{ key: 'manage_venue_menu', value: 1, strategy: 'MAX' }]
                        : []
            })
        })
    );
}

async function get(target: readonly [string, string], url: string) {
    const [modulePath, exportName] = target;
    vi.resetModules();
    const mod = (await import(modulePath)) as Record<string, Hono<AppBindings>>;
    const app = new Hono<AppBindings>();
    app.route('/', mod[exportName] as Hono<AppBindings>);
    const res = await app.request(url);
    expect(res.status).toBe(200);
    return (await res.json()).data;
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

describe('HOS-1792 public venue menu file gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        grantToPaidOwnerOnly();
    });

    it('getById withholds the menu file when the plan does not grant it', async () => {
        mockGetById.mockResolvedValue({ data: makeVenue(OWNER_FREE), error: null });
        const data = await get(BY_ID, `/${VENUE_ID}`);
        expect(data).not.toHaveProperty('menuFileUrl');
        expect(data).not.toHaveProperty('menuFileKind');
        expect(data).not.toHaveProperty('menuUrl');
    });

    it('getById returns the menu file when the plan grants it', async () => {
        mockGetById.mockResolvedValue({ data: makeVenue(OWNER_PAID), error: null });
        const data = await get(BY_ID, `/${VENUE_ID}`);
        expect(data.menuFileUrl).toBe(FILE_URL);
        expect(data.menuFileKind).toBe('PDF');
        expect(data.menuUrl).toBe('https://menu.example');
    });

    it.each([
        [OWNER_FREE, false],
        [OWNER_PAID, true]
    ] as const)('getBySlug projects menu fields for owner %s according to the plan', async (ownerId, entitled) => {
        mockGetBySlug.mockResolvedValue({ data: makeVenue(ownerId), error: null });
        const data = await get(BY_SLUG, '/slug/test-venue');
        expect(data.menuUrl).toBe(entitled ? 'https://menu.example' : undefined);
        expect(data.menuFileUrl).toBe(entitled ? FILE_URL : undefined);
        if (entitled) expect(data.menuSections).toHaveLength(1);
        else expect(data).not.toHaveProperty('menuSections');
    });

    it('publishes only active events and omits empty or unavailable specials', async () => {
        mockGetBySlug.mockResolvedValue({ data: makeVenue(OWNER_PAID), error: null });
        mockReadEffectiveSet.mockImplementation(async ({ userId, vertical }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: vertical as VerticalEnum,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [
                    { key: 'manage_venue_menu', value: 1, strategy: 'MAX' },
                    { key: 'manage_venue_daily_special', value: 1, strategy: 'MAX' },
                    { key: 'manage_venue_events', value: 1, strategy: 'MAX' }
                ]
            })
        );
        vi.mocked(getVenueEvents).mockResolvedValueOnce({
            data: {
                events: [
                    { id: 'active', isActive: true },
                    { id: 'inactive', isActive: false }
                ]
            },
            error: null
        } as never);
        vi.mocked(getVenueDailySpecials).mockResolvedValueOnce({
            data: { specials: [{ id: 'one' }, { id: 'two' }] },
            error: null
        } as never);
        const data = await get(BY_SLUG, '/slug/test-venue');
        expect(data.venueEvents).toEqual([{ id: 'active', isActive: true }]);
        expect(data.dailySpecials).toEqual([{ id: 'one' }, { id: 'two' }]);

        vi.mocked(getVenueEvents).mockResolvedValueOnce({
            data: { events: [{ id: 'inactive', isActive: false }] },
            error: null
        } as never);
        vi.mocked(getVenueDailySpecials).mockResolvedValueOnce({
            data: { specials: [] },
            error: null
        } as never);
        const empty = await get(BY_SLUG, '/slug/test-venue');
        expect(empty.venueEvents).toBeUndefined();
        expect(empty.dailySpecials).toBeUndefined();

        mockReadEffectiveSet.mockImplementation(async ({ userId, vertical }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: vertical as VerticalEnum,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: []
            })
        );
        vi.mocked(getVenueDailySpecials).mockResolvedValueOnce({
            data: { specials: [{ id: 'withheld' }] },
            error: null
        } as never);
        const withheld = await get(BY_SLUG, '/slug/test-venue');
        expect(withheld.dailySpecials).toBeUndefined();
    });

    it('does not publish menu fields for a boliche even when the owner is entitled', async () => {
        mockGetBySlug.mockResolvedValue({
            data: makeVenue(OWNER_PAID, ['nightlife']),
            error: null
        });
        const data = await get(BY_SLUG, '/slug/test-venue');
        expect(data).not.toHaveProperty('menuUrl');
        expect(data).not.toHaveProperty('menuFileUrl');
        expect(data).not.toHaveProperty('menuSections');
    });

    it.each([
        ['getById', BY_ID, `/${VENUE_ID}`],
        ['getBySlug', BY_SLUG, '/slug/test-venue'],
        ['list', LIST, '/'],
        ['getByDestination', BY_DEST, `/destination/${DEST_ID}`]
    ] as const)('never publishes menu fields for a boliche through %s', async (_name, target, url) => {
        mockGetById.mockResolvedValue({ data: makeVenue(OWNER_PAID, ['nightlife']), error: null });
        mockGetBySlug.mockResolvedValue({
            data: makeVenue(OWNER_PAID, ['nightlife']),
            error: null
        });
        mockSearch.mockResolvedValue({
            data: { items: [makeVenue(OWNER_PAID, ['nightlife'])], total: 1 },
            error: null
        });
        const data = await get(target, url);
        const venue = 'items' in data ? data.items[0] : data;
        expect(venue).not.toHaveProperty('menuUrl');
        expect(venue).not.toHaveProperty('menuFileUrl');
        expect(venue).not.toHaveProperty('menuFileKind');
        expect(venue).not.toHaveProperty('menuSections');
    });

    it('getById withholds the menu file when the entitlement lookup fails closed', async () => {
        mockReadEffectiveSet.mockRejectedValue(new Error('billing unavailable'));
        mockGetById.mockResolvedValue({ data: makeVenue(OWNER_PAID), error: null });
        const data = await get(BY_ID, `/${VENUE_ID}`);
        expect(data).not.toHaveProperty('menuFileUrl');
    });

    it.each([
        ['list', LIST, '/'],
        ['getByDestination', BY_DEST, `/destination/${DEST_ID}`]
    ] as const)('%s gates each item by its own owner', async (_name, target, url) => {
        mockSearch.mockResolvedValue({
            data: { items: [makeVenue(OWNER_FREE), makeVenue(OWNER_PAID)], total: 2 },
            error: null
        });
        const data = await get(target, url);
        expect(data.items[0]).not.toHaveProperty('menuFileUrl');
        expect(data.items[0]).not.toHaveProperty('menuFileKind');
        expect(data.items[0]).not.toHaveProperty('menuUrl');
        expect(data.items[1].menuFileUrl).toBe(FILE_URL);
        expect(data.items[1].menuFileKind).toBe('PDF');
        expect(data.items[1].menuUrl).toBe('https://menu.example');
    });
});
