/**
 * HOS-352 regression — `GET /api/v1/public/users/:id/accommodations` must be
 * ACTOR-BLIND.
 *
 * `AccommodationService._executeSearch` derives `excludeOwnerSuspended` /
 * `excludePlanRestricted` / `activeOnly` from the actor handed to it: an owner
 * whose id matches the `ownerId` filter (`isOwnScope`), or a VIP/staff actor,
 * gets DRAFT / owner-suspended / plan-restricted rows that an anonymous visitor
 * must never see. This route forwarded the REAL request actor — resolved from
 * `actorMiddleware`, which authenticates via session COOKIE — straight into
 * `accommodationService.search()`.
 *
 * `/api/v1/public/users` is in `PRIVATE_CACHE_ENDPOINTS`
 * (`apps/api/src/middlewares/cache.constants.ts`), and `generateCacheKey`
 * (`apps/api/src/middlewares/cache.ts`) builds that branch's key from the
 * `Authorization` HEADER only — never the cookie. So an owner browsing their
 * own public profile (cookie-authenticated, no `Authorization` header) landed
 * in the exact same `:anonymous` cache slot every logged-out visitor reads,
 * and their widened response — DRAFTs, suspended/plan-restricted rows, and
 * (via `_afterSearch` → `applyAccommodationLocationPrivacyList`) their
 * UNOBFUSCATED exact address — got replayed to all of them for the cache TTL.
 *
 * The fix hands the service a `createGuestActor()` instead of the real actor,
 * matching the precedent set by HOS-353
 * (`apps/api/test/routes/accommodation/public/actor-blind-cache.test.ts`).
 * This suite mocks `AccommodationService` and the route-factory (same shape as
 * the sibling `getAccommodations.rich-description.test.ts`) and asserts on the
 * ARGUMENT handed to `search()`, not on the rows that come back — the whole
 * point is that the service must never even be ASKED to widen the result.
 *
 * @module test/routes/user/public/getAccommodations.actor-blind
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Identifiers ───────────────────────────────────────────────────────────────

const OWNER_UUID = 'eeeeeeee-0000-4000-8000-000000000352';

/** The owner, logged in and viewing their OWN public profile. */
const OWNER_ACTOR = {
    id: OWNER_UUID,
    roles: ['USER'],
    permissions: []
};

/** A VIP/staff caller — the other branch `_executeSearch` widens for. */
const PRIVILEGED_ACTOR = {
    id: '11111111-0000-4000-8000-000000000352',
    roles: ['USER', 'SUPER_ADMIN'],
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    entitlements: new Set(['vip_visibility_access'])
};

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockGetActorFromContext = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { search: mockSearch };
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

// The REAL `createGuestActor` is kept — it is the thing under test. Only the
// request-actor resolver is stubbed, to simulate an owner / privileged caller
// whose session cookie authenticated them for this request.
vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: mockGetActorFromContext
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerIds: vi.fn().mockResolvedValue(new Map())
}));

/** Minimal list route-factory mock: wraps the handler in a Hono app. */
vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicListRoute: (options: {
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
            return c.json({ success: true, ...(result as object) });
        });
        return app;
    }
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Asserts the actor handed to the service is anonymous.
 *
 * Checked positively (holds exactly GUEST) AND negatively (no entitlement set,
 * no view-all permission, not the owner's id) — asserting only "not the
 * privileged actor" would pass for any other actor, including one that still
 * happened to satisfy `isOwnScope` or `hasVipAccess`.
 */
function expectGuestActor(actor: unknown): void {
    const a = actor as {
        id?: string;
        roles?: readonly string[];
        permissions?: string[];
        entitlements?: Set<string>;
    };
    expect(a.roles).toEqual(['GUEST']);
    expect(a.id).not.toBe(OWNER_UUID);
    expect(a.entitlements).toBeUndefined();
    expect(a.permissions ?? []).not.toContain('ACCOMMODATION_VIEW_ALL');
}

async function buildApp() {
    vi.resetModules();
    const { publicGetUserAccommodationsRoute } = await import(
        '../../../../src/routes/user/public/getAccommodations'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetUserAccommodationsRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicGetUserAccommodationsRoute — HOS-352 actor-blind regression', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearch.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    });

    it('hands a guest actor to search(), even when the request actor IS the owner', async () => {
        // Arrange — the owner of the accommodations is the one making the request
        // (e.g. logged into their own public profile page).
        mockGetActorFromContext.mockReturnValue(OWNER_ACTOR);

        // Act
        const app = await buildApp();
        const res = await app.request(`/${OWNER_UUID}/accommodations`);
        expect(res.status).toBe(200);

        // Assert — the service must never see the real (owner) actor.
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expectGuestActor((mockSearch.mock.calls[0] as [unknown])[0]);
    });

    it('hands a guest actor to search(), for a VIP/staff caller', async () => {
        // Arrange — a different actor entirely: staff with VIP visibility.
        mockGetActorFromContext.mockReturnValue(PRIVILEGED_ACTOR);

        // Act
        const app = await buildApp();
        const res = await app.request(`/${OWNER_UUID}/accommodations`);
        expect(res.status).toBe(200);

        // Assert
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expectGuestActor((mockSearch.mock.calls[0] as [unknown])[0]);
    });

    it('still forwards the path ownerId as the search filter, unmodified', async () => {
        mockGetActorFromContext.mockReturnValue(OWNER_ACTOR);

        const app = await buildApp();
        await app.request(`/${OWNER_UUID}/accommodations`);

        const calledParams = mockSearch.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(calledParams.ownerId).toBe(OWNER_UUID);
    });
});
