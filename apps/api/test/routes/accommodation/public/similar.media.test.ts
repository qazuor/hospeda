/**
 * HOS-963 regression — GET /api/v1/public/accommodations/:id/similar must
 * return real photos, not an empty `media` object.
 *
 * This route runs a RAW `db.query.accommodations.findMany` query (it bypasses
 * `AccommodationService.search()` on purpose — see the route's own comment),
 * so it never reaches `_afterSearch`, the chokepoint that normally composes
 * `media` from the relational `accommodation_media` table (SPEC-204). Its
 * `columns` allowlist used to select `media: true`, a key that stopped being a
 * real column in HOS-372 (it is now a relation, `many(accommodationMedia)`),
 * so every similar-card served an empty/placeholder image regardless of how
 * many photos the accommodation actually had.
 *
 * The fix batch-loads `accommodation_media` rows via
 * `accommodationMediaModel.findByAccommodations` and composes them with the
 * REAL `composeAccommodationMedia` (imported from `@repo/service-core`,
 * un-mocked here on purpose so this test exercises the actual composition
 * logic, not a stand-in for it).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── DB mock ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFindMany = vi.fn();
const mockFindByAccommodations = vi.fn();

const SOURCE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SIMILAR_ID = 'b1b2b3b4-0000-4000-8000-000000000001';
const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000000001';

/**
 * Row as the raw relational query would actually return it post-fix: no
 * `media` key (that column does not exist), a real `videos` column instead.
 */
const SIMILAR_ROW = {
    id: SIMILAR_ID,
    slug: 'lake-view-cabin',
    name: 'Lake View Cabin',
    summary: 'A cabin with a view',
    description: 'Plain description text',
    type: 'CABIN',
    isFeatured: false,
    isVerified: false,
    averageRating: 4.2,
    reviewsCount: 8,
    videos: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: DESTINATION_ID,
    ownerId: 'eeeeeeee-0000-4000-8000-000000000001',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownerSuspended: false,
    planRestricted: false,
    contactInfo: null,
    socialNetworks: null,
    destination: {
        id: DESTINATION_ID,
        name: 'Concepción del Uruguay',
        slug: 'concepcion-del-uruguay',
        summary: 'City summary',
        destinationType: 'CITY',
        level: 1,
        path: null,
        pathIds: null
    }
};

/** A single approved, visible, featured `accommodation_media` row. */
const FEATURED_MEDIA_ROW = {
    id: 'ffffffff-0000-4000-8000-000000000001',
    accommodationId: SIMILAR_ID,
    url: 'https://cdn.hospeda.com.ar/lake-view-cabin/featured.jpg',
    moderationState: 'APPROVED',
    state: 'visible',
    isFeatured: true,
    sortOrder: 0
};

/** A single approved, visible, non-featured (gallery) `accommodation_media` row. */
const GALLERY_MEDIA_ROW = {
    id: 'ffffffff-0000-4000-8000-000000000002',
    accommodationId: SIMILAR_ID,
    url: 'https://cdn.hospeda.com.ar/lake-view-cabin/gallery-1.jpg',
    moderationState: 'APPROVED',
    state: 'visible',
    isFeatured: false,
    sortOrder: 1
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
        // `composeAccommodationMedia` is intentionally left as the REAL
        // implementation (spread from `actual`) — this test asserts on its
        // real output, not a stand-in.
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

describe('publicGetSimilarRoute — HOS-963 composed media must be present', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a composed media object with the real featured image and gallery, not empty', async () => {
        mockSelect.mockImplementationOnce(() =>
            buildSelectChain([{ type: 'CABIN', destinationId: DESTINATION_ID }])
        );
        mockFindMany.mockResolvedValue([SIMILAR_ROW]);
        mockFindByAccommodations.mockResolvedValue(
            new Map([[SIMILAR_ID, [FEATURED_MEDIA_ROW, GALLERY_MEDIA_ROW]]])
        );

        const app = await buildApp();
        const res = await app.request(`/${SOURCE_ID}/similar`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = (body.data ?? []) as Array<Record<string, unknown>>;
        expect(items.length).toBeGreaterThan(0);

        const item = items[0] as {
            media?: { featuredImage?: { url?: string }; gallery?: Array<{ url?: string }> };
        };

        // The regression: before the fix `media` was always `{}` because the
        // route selected a `media` column that no longer exists.
        expect(item.media).toBeDefined();
        expect(item.media?.featuredImage).toBeDefined();
        expect(item.media?.featuredImage?.url).toBe(FEATURED_MEDIA_ROW.url);
        expect(item.media?.gallery).toBeDefined();
        expect(item.media?.gallery?.[0]?.url).toBe(GALLERY_MEDIA_ROW.url);

        // The batch finder must be called with the similar accommodation's id
        // (not the source id), proving the composition is wired per-row.
        expect(mockFindByAccommodations).toHaveBeenCalledWith(
            expect.objectContaining({ accommodationIds: [SIMILAR_ID] })
        );
    });

    it('omits featuredImage/gallery (empty media) when the accommodation has no approved photos', async () => {
        mockSelect.mockImplementationOnce(() =>
            buildSelectChain([{ type: 'CABIN', destinationId: DESTINATION_ID }])
        );
        mockFindMany.mockResolvedValue([SIMILAR_ROW]);
        mockFindByAccommodations.mockResolvedValue(new Map());

        const app = await buildApp();
        const res = await app.request(`/${SOURCE_ID}/similar`);
        const body = await res.json();
        const item = (body.data as Array<Record<string, unknown>>)[0] as {
            media?: { featuredImage?: unknown; gallery?: unknown };
        };

        expect(item.media).toBeDefined();
        expect(item.media?.featuredImage).toBeUndefined();
        expect(item.media?.gallery).toBeUndefined();
    });
});
