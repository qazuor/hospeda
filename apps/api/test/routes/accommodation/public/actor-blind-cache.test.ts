/**
 * HOS-353 regression — the shared-cached public accommodation routes must be
 * ACTOR-BLIND.
 *
 * `/api/v1/public/accommodations` is the first entry in `PUBLIC_CACHE_ENDPOINTS`
 * and the match is `startsWith`, so the listing AND the two detail routes are
 * stored under `public:<path><query>` — a key with NO actor component
 * (`cache.ts`, public branch, unlike the private branch right below it). The
 * cache middleware is also registered BEFORE the auth middleware, so a HIT never
 * reaches auth at all.
 *
 * Any payload that varies by READER therefore leaks: the first privileged
 * request parks its response in the slot every anonymous visitor reads for the
 * whole TTL. Three mechanisms did exactly that, and each has a case below.
 *
 * The reference implementations are the two sibling routes that already got this
 * right — `getByDestination` and `getTopRatedByDestination` resolve against
 * `createGuestActor()`, so no reader can widen what they return.
 *
 * These assertions are about WHICH ACTOR the handler resolves visibility with,
 * not about the rows themselves: the service and the model are the wrong place to
 * pin this, because their actor-aware behavior is correct and load-bearing for the
 * protected and admin tiers.
 *
 * @module test/routes/accommodation/public/actor-blind-cache
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Identifiers ───────────────────────────────────────────────────────────────

const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000000353';
const ACC_ID = 'aaaaaaaa-0000-4000-8000-000000000353';

/** A privileged reader: staff-ish role plus the VIP visibility entitlement. */
const PRIVILEGED_ACTOR = {
    id: '11111111-0000-4000-8000-000000000353',
    role: 'SUPER_ADMIN',
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    entitlements: new Set(['vip_visibility_access'])
};

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockGetById = vi.fn();
const mockGetBySlug = vi.fn();
const mockResolveSingle = vi.fn();
const mockResolveBatch = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                search: mockSearch,
                getById: mockGetById,
                getBySlug: mockGetBySlug
            };
        }),
        SearchHistoryService: vi.fn().mockImplementation(function () {
            return { record: vi.fn().mockResolvedValue(undefined) };
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

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerId: mockResolveSingle,
    resolveOwnerEntitlementsForOwnerIds: mockResolveBatch
}));

// The REAL `createGuestActor` is kept — it is the thing under test. Only the
// request-actor resolver is stubbed, to simulate a privileged caller.
vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => PRIVILEGED_ACTOR),
        isGuestActor: vi.fn(() => false)
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/routes/accommodation/public/quick-amenity-resolver', () => ({
    resolveQuickAmenityFlags: vi.fn().mockResolvedValue([])
}));

vi.mock('../../../../src/utils/route-factory', () => {
    const build = (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, string>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(
                c,
                c.req.param(),
                undefined,
                c.req.query() as Record<string, string>
            );
            return c.json({ success: true, data: result });
        });
        return app;
    };
    return { createPublicListRoute: build, createPublicRoute: build };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Asserts the actor handed to a service is anonymous.
 *
 * Checked positively (role GUEST) AND negatively (no entitlement set, no
 * view-all permission): asserting only "not the privileged actor" would pass for
 * any actor at all, including a differently-privileged one.
 */
function expectGuestActor(actor: unknown): void {
    const a = actor as {
        role?: string;
        permissions?: string[];
        entitlements?: Set<string>;
    };
    expect(a.role).toBe('GUEST');
    expect(a.entitlements).toBeUndefined();
    expect(a.permissions ?? []).not.toContain('ACCOMMODATION_VIEW_ALL');
}

async function buildListApp() {
    vi.resetModules();
    const { publicListAccommodationsRoute } = await import(
        '../../../../src/routes/accommodation/public/list'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicListAccommodationsRoute);
    return app;
}

async function buildGetByIdApp() {
    vi.resetModules();
    const { publicGetAccommodationByIdRoute } = await import(
        '../../../../src/routes/accommodation/public/getById'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetAccommodationByIdRoute);
    return app;
}

async function buildGetBySlugApp() {
    vi.resetModules();
    const { publicGetAccommodationBySlugRoute } = await import(
        '../../../../src/routes/accommodation/public/getBySlug'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetAccommodationBySlugRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HOS-353 — public cached accommodation routes resolve against a guest actor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveSingle.mockResolvedValue([]);
        mockResolveBatch.mockResolvedValue(new Map());
    });

    it('list: hands a guest actor to the search service even for a VIP/staff caller', async () => {
        mockSearch.mockResolvedValue({ data: { items: [], total: 0 }, error: null });

        const app = await buildListApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        expect(mockSearch).toHaveBeenCalledTimes(1);
        const [actorArg] = mockSearch.mock.calls[0] as [unknown];
        expectGuestActor(actorArg);
    });

    it('getById: hands a guest actor to the service even for a VIP/staff caller', async () => {
        // `null` data short-circuits the handler before the downstream enrichment,
        // which is irrelevant to what this pins.
        mockGetById.mockResolvedValue({ data: null, error: null });

        const app = await buildGetByIdApp();
        const res = await app.request(`/${ACC_ID}`);
        expect(res.status).toBe(200);

        expect(mockGetById).toHaveBeenCalledTimes(1);
        const [actorArg] = mockGetById.mock.calls[0] as [unknown];
        expectGuestActor(actorArg);
    });

    it('getBySlug: hands a guest actor to the service even for a VIP/staff caller', async () => {
        mockGetBySlug.mockResolvedValue({ data: null, error: null });

        const app = await buildGetBySlugApp();
        const res = await app.request('/slug/cabana-del-rio');
        expect(res.status).toBe(200);

        expect(mockGetBySlug).toHaveBeenCalledTimes(1);
        const [actorArg] = mockGetBySlug.mock.calls[0] as [unknown];
        expectGuestActor(actorArg);
    });
});

describe('HOS-353 — the video gate is derived from the OWNER', () => {
    /**
     * `CAN_EMBED_VIDEO` exists only in the OWNER_PRO / OWNER_PREMIUM /
     * COMPLEX_PRO / COMPLEX_PREMIUM plans — host plans. No TOURIST plan carries
     * it, and its description is "Allows embedding videos in accommodation
     * listing". Checking it against the READER therefore asked the wrong subject
     * entirely: a tourist can never hold it, so the host's paid video was stripped
     * for every ordinary visitor, and surfaced only by accident when another host
     * populated the shared cache slot first.
     *
     * Note these cases can no longer express a "reader" at all: the function does
     * not take the Hono context any more. That is deliberate, and it means the
     * viewer-independence is pinned STRUCTURALLY by
     * `entitlement-filter.viewer-blind.test.ts`, not by an assertion here that
     * could only be written by re-adding the hazard.
     */
    function makeAccommodation(): Record<string, unknown> {
        return {
            id: ACC_ID,
            ownerId: OWNER_ID,
            slug: 'cabana-del-rio',
            name: 'Cabaña del Río',
            description: 'Plain description',
            videoUrl: 'https://videos.example.com/tour.mp4',
            media: [
                { type: 'image', url: 'https://img.example.com/a.jpg' },
                { type: 'video', url: 'https://videos.example.com/tour.mp4' }
            ],
            isVerified: false,
            contactInfo: {}
        };
    }

    it('keeps the video when the OWNER holds CAN_EMBED_VIDEO', async () => {
        const { filterAccommodationByEntitlements } = await import(
            '../../../../src/utils/entitlement-filter'
        );

        const filtered = filterAccommodationByEntitlements(makeAccommodation() as never, [
            EntitlementKey.CAN_EMBED_VIDEO
        ]) as Record<string, unknown>;

        expect(filtered.videoUrl).toBe('https://videos.example.com/tour.mp4');
        expect(filtered.media).toHaveLength(2);
    });

    it('strips the video when the OWNER lacks it — the empty set the routes pass for an ownerless row', async () => {
        const { filterAccommodationByEntitlements } = await import(
            '../../../../src/utils/entitlement-filter'
        );

        const filtered = filterAccommodationByEntitlements(
            makeAccommodation() as never,
            []
        ) as Record<string, unknown>;

        expect(filtered).not.toHaveProperty('videoUrl');
        expect(filtered.media).toHaveLength(1);
        expect((filtered.media as Array<{ type: string }>)[0]?.type).toBe('image');
    });

    it('leaves the video alone when owner entitlements are omitted (admin/internal call site)', async () => {
        const { filterAccommodationByEntitlements } = await import(
            '../../../../src/utils/entitlement-filter'
        );

        // Same convention the two owner gates above already use: `undefined` means
        // "not a public read, do not gate", which is NOT the same as `[]`.
        const filtered = filterAccommodationByEntitlements(makeAccommodation() as never) as Record<
            string,
            unknown
        >;

        expect(filtered.videoUrl).toBe('https://videos.example.com/tour.mp4');
        expect(filtered.media).toHaveLength(2);
    });
});
