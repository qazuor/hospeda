/**
 * HOS-929 regression — the similar-accommodations endpoint must feature a row
 * whose owner holds a FEATURED_LISTING entitlement (plan or addon), even when
 * the admin-curated `isFeatured` column is `false`.
 *
 * `similar.ts` is a raw relational query on `getDb()` that bypasses the
 * service/model layer entirely (see its own file header), so it is the
 * easiest of the affected routes to silently miss when wiring the public OR:
 * unlike the other public routes, it must explicitly SELECT
 * `featuredByEntitlement` in its Drizzle `columns` allowlist or the OR
 * degrades to `isFeatured` alone with no type error to catch it.
 *
 * Mirrors the mock strategy of `similar.rich-description.test.ts`.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── DB mock ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFindMany = vi.fn();
const mockFindByAccommodations = vi.fn().mockResolvedValue(new Map());

/** Row shape as it comes off the DB — includes both featured source columns. */
const ACCOMMODATION_ENTITLEMENT_FEATURED = {
    id: 'b1b2b3b4-0000-4000-8000-000000000002',
    slug: 'entitlement-featured-similar',
    name: 'Entitlement Featured Similar',
    summary: 'A lodge featured only via billing entitlement',
    description: 'Plain description text',
    type: 'CABIN',
    // HOS-929 bug case: admin-curated flag is false, entitlement flag is true.
    isFeatured: false,
    featuredByEntitlement: true,
    isVerified: false,
    averageRating: 4.5,
    reviewsCount: 10,
    media: null,
    videos: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: 'dddddddd-0000-4000-8000-000000000002',
    ownerId: 'eeeeeeee-0000-4000-8000-000000000002',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownerSuspended: false,
    planRestricted: false,
    contactInfo: null,
    socialNetworks: null,
    destination: {
        id: 'dddddddd-0000-4000-8000-000000000002',
        name: 'Concepción del Uruguay',
        slug: 'concepcion-del-uruguay',
        summary: 'City summary',
        destinationType: 'CITY',
        level: 1,
        path: null,
        pathIds: null
    }
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockSelect,
            query: {
                accommodations: {
                    findMany: mockFindMany
                }
            }
        })),
        accommodations: {
            id: 'acc.id',
            slug: 'acc.slug',
            type: 'acc.type',
            destinationId: 'acc.destinationId',
            lifecycleState: 'acc.lifecycleState',
            visibility: 'acc.visibility',
            averageRating: 'acc.averageRating'
        },
        accommodationMediaModel: {
            findByAccommodations: mockFindByAccommodations
        }
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        ServiceError: class ServiceError extends Error {
            public readonly code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
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

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, unknown>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c, c.req.param(), undefined, c.req.query());
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const SOURCE_ID = 'aaaaaaaa-0000-4000-8000-000000000002';

function buildSelectChain(rows: unknown[]) {
    return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows)
    };
}

async function buildApp() {
    vi.resetModules();
    const { publicGetSimilarRoute } = await import(
        '../../../../src/routes/accommodation/public/similar'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetSimilarRoute);
    return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('publicGetSimilarRoute — HOS-929 featured entitlement OR', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reports isFeatured=true for a row featured only via featuredByEntitlement', async () => {
        mockSelect.mockImplementationOnce(function () {
            return buildSelectChain([
                {
                    type: 'CABIN',
                    destinationId: 'dddddddd-0000-4000-8000-000000000002'
                }
            ]);
        });

        mockFindMany.mockResolvedValue([ACCOMMODATION_ENTITLEMENT_FEATURED]);

        const app = await buildApp();
        const res = await app.request(`/${SOURCE_ID}/similar`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = (body.data ?? []) as Array<Record<string, unknown>>;
        expect(items.length).toBeGreaterThan(0);
        expect(items[0]?.isFeatured).toBe(true);
        // Note: `featuredByEntitlement` stripping from the public payload is the
        // job of `AccommodationPublicSchema` via `stripWithSchema` (the route
        // factory's real response pipeline), which this test's route-factory
        // mock deliberately bypasses to exercise the handler directly. That
        // stripping guarantee has its own dedicated test:
        // `packages/schemas/test/entities/accommodation/accommodation.access.schema.test.ts`
        // — "AccommodationPublicSchema — featuredByEntitlement strip (HOS-929)".
    });
});
