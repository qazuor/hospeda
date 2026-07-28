/**
 * HOS-341 regression — the by-owner accommodations listing must gate
 * `isVerified` by the OWNER's `HAS_VERIFICATION_BADGE` entitlement.
 *
 * `isVerified` is a billable trust badge (SPEC-291 Phase 3b). Four sibling
 * public listings already resolve the owners' entitlements in one batch and
 * force `isVerified=false` for owners that lack the badge; this route did not,
 * so the raw DB value rode the card straight to the client.
 *
 * Unlike the feature and destination listings, `/api/v1/public/users` is in
 * `PRIVATE_CACHE_ENDPOINTS`, not the public set. That does NOT mean one reader
 * per cache slot: `generateCacheKey` builds the private-cache identifier as
 * `private:<path><query>:<authorization ?? 'anonymous'>`, and browsers
 * authenticate with a Better Auth cookie rather than an `Authorization` header,
 * so every anonymous and cookie-authenticated caller collides on the single
 * `anonymous` slot. The un-gated badge was replayed there for the whole TTL too.
 *
 * The replay itself is harmless — the payload is owner-derived and identical for
 * every reader — which is exactly the property that keeps this gate safe to
 * compute inside a cached response. The entitlement bypass was the real defect,
 * and it was identical on all three routes.
 *
 * The gate is keyed on the OWNER of the row, never on the reader.
 *
 * @module test/routes/user/public/getAccommodations.badge-gate
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Identifiers ───────────────────────────────────────────────────────────────

const OWNER_WITH_BADGE = 'eeeeeeee-0000-4000-8000-000000000341';
const OWNER_WITHOUT_BADGE = 'eeeeeeee-0000-4000-8000-000000000342';

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockResolveBatch = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                search: mockSearch
            };
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
    resolveOwnerEntitlementsForOwnerIds: mockResolveBatch
}));

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => ({
            id: '00000000-0000-4000-8000-000000000000',
            role: 'GUEST',
            permissions: []
        }))
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Builds an accommodation row as `AccommodationService.search` returns it.
 * `isVerified` defaults to `true` on purpose: the gate short-circuits on falsy
 * values, so a `false` fixture never reaches the branch under test.
 */
function makeAccommodation(
    overrides: Partial<{ id: string; slug: string; ownerId: string; isVerified: boolean }>
): Record<string, unknown> {
    return {
        id: 'acc-user-default',
        slug: 'user-default',
        name: 'Test Lodge',
        summary: 'A nice lodge',
        description: 'Plain description text',
        type: 'CABIN',
        isFeatured: false,
        isVerified: true,
        averageRating: 4.5,
        reviewsCount: 10,
        media: null,
        price: null,
        location: null,
        seo: null,
        extraInfo: null,
        destinationId: 'dddddddd-0000-4000-8000-000000000341',
        ownerId: OWNER_WITH_BADGE,
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ownerSuspended: false,
        planRestricted: false,
        ...overrides
    };
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp() {
    vi.resetModules();
    const { publicGetUserAccommodationsRoute } = await import(
        '../../../../src/routes/user/public/getAccommodations'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetUserAccommodationsRoute);
    return app;
}

async function requestItemsFor(ownerId: string): Promise<Array<Record<string, unknown>>> {
    const app = await buildApp();
    const res = await app.request(`/${ownerId}/accommodations`);
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.items as Array<Record<string, unknown>>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicGetUserAccommodationsRoute — HOS-341 isVerified owner gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forces isVerified=false when the owner LACKS HAS_VERIFICATION_BADGE', async () => {
        mockResolveBatch.mockResolvedValue(new Map([[OWNER_WITHOUT_BADGE, []]]));
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-no-badge',
                        ownerId: OWNER_WITHOUT_BADGE,
                        isVerified: true
                    })
                ],
                total: 1
            },
            error: null
        });

        const items = await requestItemsFor(OWNER_WITHOUT_BADGE);

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('preserves isVerified=true when the owner HAS HAS_VERIFICATION_BADGE', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-with-badge',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    })
                ],
                total: 1
            },
            error: null
        });

        const items = await requestItemsFor(OWNER_WITH_BADGE);

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(true);
    });

    it('keeps isVerified=false for an un-verified row even when the owner HAS the badge', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-unverified',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: false
                    })
                ],
                total: 1
            },
            error: null
        });

        const items = await requestItemsFor(OWNER_WITH_BADGE);

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('forces isVerified=false when the owner is absent from the map (fail-closed)', async () => {
        // The real batch resolver never throws: on a failed role query or a failed
        // per-owner billing lookup it sets an EMPTY ENTITLEMENT ARRAY for that owner,
        // and it returns an empty Map only for an empty id list. An empty Map is
        // therefore the worst case — every owner unresolved — and must grant nothing.
        mockResolveBatch.mockResolvedValue(new Map());
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-absent-owner',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    })
                ],
                total: 1
            },
            error: null
        });

        const items = await requestItemsFor(OWNER_WITH_BADGE);

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('resolves entitlements in ONE batch call with the deduplicated owner IDs', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({ id: 'acc-x1', ownerId: OWNER_WITH_BADGE }),
                    makeAccommodation({ id: 'acc-x2', ownerId: OWNER_WITH_BADGE }),
                    makeAccommodation({ id: 'acc-x3', ownerId: OWNER_WITH_BADGE })
                ],
                total: 3
            },
            error: null
        });

        await requestItemsFor(OWNER_WITH_BADGE);

        expect(mockResolveBatch).toHaveBeenCalledTimes(1);
        const [calledWith] = mockResolveBatch.mock.calls[0] as [string[]];
        expect(calledWith).toEqual([OWNER_WITH_BADGE]);
    });

    it('forces isVerified=false for a row whose ownerId is missing', async () => {
        // No ownerId means no owner to attribute the badge to. The handler must not
        // pass it to the resolver, and the gate must not let it through unchanged.
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [{ ...makeAccommodation({ id: 'acc-ownerless' }), ownerId: undefined }],
                total: 1
            },
            error: null
        });

        const items = await requestItemsFor(OWNER_WITH_BADGE);

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
        const [calledWith] = mockResolveBatch.mock.calls[0] as [string[]];
        expect(calledWith).toEqual([]);
    });

    it('resolves an empty id list when the page carries no items', async () => {
        mockResolveBatch.mockResolvedValue(new Map());
        mockSearch.mockResolvedValue({
            data: { items: [], total: 0 },
            error: null
        });

        const items = await requestItemsFor(OWNER_WITH_BADGE);

        expect(items).toHaveLength(0);
        expect(mockResolveBatch).toHaveBeenCalledTimes(1);
        const [calledWith] = mockResolveBatch.mock.calls[0] as [string[]];
        expect(calledWith).toEqual([]);
    });

    // NOT coverage of the HOS-341 gate: with the gate reverted this passes too,
    // because the reverted route never calls the resolver either. It pins the
    // service-error EARLY RETURN, so a later refactor cannot hoist the gate above
    // it and start resolving entitlements for a page that was never built.
    it('returns the empty page from the service-error early return without reaching the gate', async () => {
        mockResolveBatch.mockResolvedValue(new Map());
        mockSearch.mockResolvedValue({
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });

        const items = await requestItemsFor(OWNER_WITH_BADGE);

        expect(items).toHaveLength(0);
        expect(mockResolveBatch).not.toHaveBeenCalled();
    });
});
