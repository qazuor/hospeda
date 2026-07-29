/**
 * HOS-341 regression — the destination accommodations listing must gate
 * `isVerified` by the OWNER's `HAS_VERIFICATION_BADGE` entitlement.
 *
 * `isVerified` is a billable trust badge (SPEC-291 Phase 3b). Four sibling
 * public listings already resolve the owners' entitlements in one batch and
 * force `isVerified=false` for owners that lack the badge; this route did not,
 * so the raw DB value rode the card straight to the client.
 *
 * The route also lives under `/api/v1/public/destinations`, a shared-cached
 * prefix whose cache key carries no `Authorization` header — an un-gated badge
 * is served to every visitor for the whole TTL, not just to the first one.
 *
 * The gate is keyed on the OWNER of the row, never on the reader, which is what
 * makes it safe to compute inside a shared-cached response.
 *
 * This route returns a BARE ARRAY (not an `{ items, pagination }` envelope), so
 * the response body is read from `body.data`.
 *
 * @module test/routes/destination/public/getAccommodations.badge-gate
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Identifiers ───────────────────────────────────────────────────────────────

const DEST_ID = 'dddddddd-0000-4000-8000-000000000341';
const OWNER_WITH_BADGE = 'eeeeeeee-0000-4000-8000-000000000341';
const OWNER_WITHOUT_BADGE = 'eeeeeeee-0000-4000-8000-000000000342';

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockGetAccommodations = vi.fn();
const mockResolveBatch = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        DestinationService: vi.fn().mockImplementation(function () {
            return {
                getAccommodations: mockGetAccommodations
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
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: { req: { param: () => Record<string, string> } },
            params: Record<string, unknown>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c, c.req.param());
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Builds an accommodation row as the service returns it (`findAll` runs
 * `SELECT *`). `isVerified` defaults to `true` on purpose: the gate
 * short-circuits on falsy values, so a `false` fixture never reaches the branch
 * under test.
 */
function makeAccommodation(
    overrides: Partial<{ id: string; slug: string; ownerId: string; isVerified: boolean }>
): Record<string, unknown> {
    return {
        id: 'acc-destination-default',
        slug: 'destination-default',
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
        destinationId: DEST_ID,
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
    const { publicGetDestinationAccommodationsRoute } = await import(
        '../../../../src/routes/destination/public/getAccommodations'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetDestinationAccommodationsRoute);
    return app;
}

async function requestItems(): Promise<Array<Record<string, unknown>>> {
    const app = await buildApp();
    const res = await app.request(`/${DEST_ID}/accommodations`);
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.data as Array<Record<string, unknown>>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicGetDestinationAccommodationsRoute — HOS-341 isVerified owner gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forces isVerified=false when the owner LACKS HAS_VERIFICATION_BADGE', async () => {
        mockResolveBatch.mockResolvedValue(new Map([[OWNER_WITHOUT_BADGE, []]]));
        mockGetAccommodations.mockResolvedValue({
            data: {
                accommodations: [
                    makeAccommodation({
                        id: 'acc-no-badge',
                        ownerId: OWNER_WITHOUT_BADGE,
                        isVerified: true
                    })
                ]
            },
            error: null
        });

        const items = await requestItems();

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('preserves isVerified=true when the owner HAS HAS_VERIFICATION_BADGE', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockGetAccommodations.mockResolvedValue({
            data: {
                accommodations: [
                    makeAccommodation({
                        id: 'acc-with-badge',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    })
                ]
            },
            error: null
        });

        const items = await requestItems();

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(true);
    });

    it('gates each item independently on a mixed page', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([
                [OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]],
                [OWNER_WITHOUT_BADGE, []]
            ])
        );
        mockGetAccommodations.mockResolvedValue({
            data: {
                accommodations: [
                    makeAccommodation({ id: 'acc-a', ownerId: OWNER_WITH_BADGE, isVerified: true }),
                    makeAccommodation({
                        id: 'acc-b',
                        ownerId: OWNER_WITHOUT_BADGE,
                        isVerified: true
                    }),
                    makeAccommodation({ id: 'acc-c', ownerId: OWNER_WITH_BADGE, isVerified: false })
                ]
            },
            error: null
        });

        const items = await requestItems();

        expect(items).toHaveLength(3);
        expect(items.find((i) => i.id === 'acc-a')?.isVerified).toBe(true);
        expect(items.find((i) => i.id === 'acc-b')?.isVerified).toBe(false);
        expect(items.find((i) => i.id === 'acc-c')?.isVerified).toBe(false);
    });

    it('forces isVerified=false when the owner is absent from the map (fail-closed)', async () => {
        // The real batch resolver never throws: on a failed role query or a failed
        // per-owner billing lookup it sets an EMPTY ENTITLEMENT ARRAY for that owner,
        // and it returns an empty Map only for an empty id list. An empty Map is
        // therefore the worst case — every owner unresolved — and must grant nothing.
        mockResolveBatch.mockResolvedValue(new Map());
        mockGetAccommodations.mockResolvedValue({
            data: {
                accommodations: [
                    makeAccommodation({
                        id: 'acc-absent-owner',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    })
                ]
            },
            error: null
        });

        const items = await requestItems();

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('resolves entitlements in ONE batch call with the deduplicated owner IDs', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockGetAccommodations.mockResolvedValue({
            data: {
                accommodations: [
                    makeAccommodation({ id: 'acc-x1', ownerId: OWNER_WITH_BADGE }),
                    makeAccommodation({ id: 'acc-x2', ownerId: OWNER_WITH_BADGE }),
                    makeAccommodation({ id: 'acc-x3', ownerId: OWNER_WITH_BADGE })
                ]
            },
            error: null
        });

        await requestItems();

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
        mockGetAccommodations.mockResolvedValue({
            data: {
                accommodations: [
                    { ...makeAccommodation({ id: 'acc-ownerless' }), ownerId: undefined }
                ]
            },
            error: null
        });

        const items = await requestItems();

        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
        const [calledWith] = mockResolveBatch.mock.calls[0] as [string[]];
        expect(calledWith).toEqual([]);
    });

    it('resolves an empty id list when the response carries no accommodations', async () => {
        mockResolveBatch.mockResolvedValue(new Map());
        mockGetAccommodations.mockResolvedValue({
            data: { accommodations: [] },
            error: null
        });

        const items = await requestItems();

        expect(items).toHaveLength(0);
        expect(mockResolveBatch).toHaveBeenCalledTimes(1);
        const [calledWith] = mockResolveBatch.mock.calls[0] as [string[]];
        expect(calledWith).toEqual([]);
    });
});
