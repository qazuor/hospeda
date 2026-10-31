/**
 * HOS-1792 regression: the public venue reads that return the stored row
 * (by-id, list, by-destination) must withhold `menuFileUrl` / `menuFileKind`
 * when the OWNER's plan does not grant `manage_venue_menu`, exactly as by-slug
 * does through `applyVenueMenuManagementGate`.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const OWNER_PAID = 'eeeeeeee-0000-4000-8000-000000001792';
const OWNER_FREE = 'eeeeeeee-0000-4000-8000-000000001793';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000001792';
const DEST_ID = 'dddddddd-0000-4000-8000-000000001792';
const FILE_URL = 'https://res.cloudinary.com/x/menu.pdf';

const mockGetById = vi.fn();
const mockSearch = vi.fn();
const mockReadEffectiveKeys = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        VenueService: vi.fn().mockImplementation(function () {
            return { getById: mockGetById, search: mockSearch };
        })
    };
});

vi.mock('../../../../src/utils/listing-access/user-gate', () => ({
    readEffectiveKeys: mockReadEffectiveKeys
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

function makeVenue(ownerId: string): Record<string, unknown> {
    return {
        id: VENUE_ID,
        ownerId,
        menuFileUrl: FILE_URL,
        menuFileKind: 'PDF',
        featuredByEntitlement: false,
        isFeatured: false
    };
}

/** Grants `manage_venue_menu` to OWNER_PAID only. */
function grantToPaidOwnerOnly(): void {
    mockReadEffectiveKeys.mockImplementation(async ({ userId }: { userId: string }) => ({
        manage_venue_menu: userId === OWNER_PAID
    }));
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
        expect(data.menuFileUrl).toBeNull();
        expect(data.menuFileKind).toBeNull();
    });

    it('getById returns the menu file when the plan grants it', async () => {
        mockGetById.mockResolvedValue({ data: makeVenue(OWNER_PAID), error: null });
        const data = await get(BY_ID, `/${VENUE_ID}`);
        expect(data.menuFileUrl).toBe(FILE_URL);
        expect(data.menuFileKind).toBe('PDF');
    });

    it('getById withholds the menu file when the entitlement lookup fails closed', async () => {
        mockReadEffectiveKeys.mockResolvedValue({ manage_venue_menu: false });
        mockGetById.mockResolvedValue({ data: makeVenue(OWNER_PAID), error: null });
        const data = await get(BY_ID, `/${VENUE_ID}`);
        expect(data.menuFileUrl).toBeNull();
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
        expect(data.items[0].menuFileUrl).toBeNull();
        expect(data.items[0].menuFileKind).toBeNull();
        expect(data.items[1].menuFileUrl).toBe(FILE_URL);
        expect(data.items[1].menuFileKind).toBe('PDF');
    });
});
