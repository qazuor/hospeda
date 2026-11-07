import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const mocks = vi.hoisted(() => ({
    getById: vi.fn(),
    getBySlug: vi.fn(),
    search: vi.fn(),
    effectiveSet: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    ExperienceService: class {
        getById = mocks.getById;
        getBySlug = mocks.getBySlug;
        search = mocks.search;
    },
    ServiceError: class extends Error {
        constructor(_code: string, message: string) {
            super(message);
        }
    }
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));
vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: () => ({ id: 'guest', roles: ['GUEST'], permissions: [] })
}));
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../../../../src/utils/listing-catalog-relations', () => ({
    fetchExperienceAmenities: vi.fn(async () => []),
    fetchExperienceFeatures: vi.fn(async () => [])
}));
vi.mock('../../../../src/utils/route-factory', () => {
    const build = (options: {
        method: 'get';
        path: string;
        handler: (
            ctx: unknown,
            params: Record<string, string>,
            body: unknown,
            query: Record<string, string>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        app.get(options.path.replace(/\{([^}]+)\}/g, ':$1'), async (ctx) =>
            ctx.json({
                data: await options.handler(ctx, ctx.req.param(), undefined, ctx.req.query())
            })
        );
        return app;
    };
    return { createPublicRoute: build, createPublicListRoute: build };
});

const ID = '33333333-3333-4333-8333-333333333333';
const experience = {
    id: ID,
    ownerId: '11111111-1111-4111-8111-111111111111',
    businessLines: ['standard'],
    name: 'Kayak',
    slug: 'kayak',
    publicationStatus: 'PUBLISHED'
};
const readers = [
    [
        'getBySlug',
        '../../../../src/routes/experience/public/getBySlug',
        'publicGetExperienceBySlugRoute',
        '/slug/kayak'
    ],
    [
        'getById',
        '../../../../src/routes/experience/public/getById',
        'publicGetExperienceByIdRoute',
        `/${ID}`
    ],
    [
        'list',
        '../../../../src/routes/experience/public/list',
        'publicListExperiencesRoute',
        '/?limit=1'
    ],
    [
        'getByDestination',
        '../../../../src/routes/experience/public/getByDestination',
        'publicGetExperiencesByDestinationRoute',
        `/destination/${ID}?limit=1`
    ]
] as const;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({ data: experience, error: null });
    mocks.getBySlug.mockResolvedValue({ data: experience, error: null });
    mocks.search.mockResolvedValue({ data: { items: [experience], total: 1 }, error: null });
    mocks.effectiveSet.mockRejectedValue(new Error('billing unavailable'));
});

describe('TEST:3.12:3 experience public HTTP readers fail closed', () => {
    it.each(
        readers
    )('%s returns 2xx, hides keyed fields and sends no-store', async (_name, path, symbol, url) => {
        vi.resetModules();
        const module = (await import(path)) as Record<string, Hono<AppBindings>>;
        const app = new Hono<AppBindings>();
        app.route('/', module[symbol]!);
        const response = await app.request(url);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        const body = await response.json();
        const data = body.data;
        const listing = Array.isArray(data?.items) ? data.items[0] : data;
        expect(listing).not.toHaveProperty('meetingPointDirections');
    });
});
