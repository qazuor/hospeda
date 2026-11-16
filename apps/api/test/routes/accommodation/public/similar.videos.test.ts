/**
 * HOS-2191 regression: GET /api/v1/public/accommodations/:id/similar must not
 * expose `media.videos` for an owner without the `can_embed_video` entitlement,
 * and must keep exposing them for an owner who holds it.
 *
 * The route used to rebuild `media` from the raw `videos` column AFTER the
 * owner-gated projection ran, which put the stripped videos back.
 */

import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
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
    videos: [{ url: 'https://example.com/tour.mp4' }],
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: DESTINATION_ID,
    ownerId: 'eeeeeeee-0000-4000-8000-000000000001',
    publicationStatus: 'PUBLISHED',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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

const keysByOwner = vi.hoisted(() => ({ current: [] as string[] }));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: ({ userId, vertical }: { userId: string; vertical: string }) =>
            Promise.resolve(
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical: vertical as VerticalEnum,
                    hasLiveNonTrialTitle: false,
                    inheritsTouristVip: false,
                    entries: keysByOwner.current.map((key) => ({
                        key,
                        value: 1,
                        strategy: 'MAX' as const
                    }))
                })
            )
    })
}));

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
            publicationStatus: 'acc.publicationStatus',
            type: 'acc.type',
            destinationId: 'acc.destinationId',
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

async function requestItem(): Promise<{ media?: { videos?: unknown[] } }> {
    mockSelect.mockImplementationOnce(() =>
        buildSelectChain([{ type: 'CABIN', destinationId: DESTINATION_ID }])
    );
    mockFindMany.mockResolvedValue([SIMILAR_ROW]);
    mockFindByAccommodations.mockResolvedValue(new Map());
    const app = await buildApp();
    const res = await app.request(`/${SOURCE_ID}/similar`);
    expect(res.status).toBe(200);
    const body = await res.json();
    return (body.data as Array<{ media?: { videos?: unknown[] } }>)[0] as {
        media?: { videos?: unknown[] };
    };
}

describe('publicGetSimilarRoute: HOS-2191 video gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        keysByOwner.current = [];
    });

    it('returns no videos for an owner without can_embed_video', async () => {
        const item = await requestItem();
        expect(item.media?.videos ?? []).toEqual([]);
    });

    it('keeps the videos for an owner who holds can_embed_video', async () => {
        keysByOwner.current = ['can_embed_video'];
        const item = await requestItem();
        expect(item.media?.videos).toEqual([{ url: 'https://example.com/tour.mp4' }]);
    });
});
