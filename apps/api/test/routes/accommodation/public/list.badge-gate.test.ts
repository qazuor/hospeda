/**
 * SPEC-291 Phase 3b — isVerified badge gate on the public accommodation list.
 *
 * Verifies that the listing endpoint forces `isVerified=false` when the
 * accommodation's owner lacks `HAS_VERIFICATION_BADGE`, even though the DB row
 * has `isVerified=true`. The gate uses the batch resolver
 * `resolveOwnerEntitlementsForOwnerIds` (one DB query per page).
 *
 * Test cases (all assertions UNCONDITIONAL):
 *   1. Verified accommodation + owner HAS the badge → isVerified=true in response.
 *   2. Verified accommodation + owner LACKS the badge → isVerified=false in response.
 *   3. Un-verified accommodation + owner HAS the badge → isVerified=false in response.
 *   4. Mixed page: each item gated independently.
 *   5. Batch resolver called once per unique owner (not once per item).
 *
 * @module test/routes/accommodation/public/list.badge-gate
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ---------------------------------------------------------------------------
// Owner IDs for the tests
// ---------------------------------------------------------------------------

const OWNER_WITH_BADGE = 'badge-owner-0001-4000-8000-000000000001';
const OWNER_WITHOUT_BADGE = 'badge-owner-0002-4000-8000-000000000002';

// ---------------------------------------------------------------------------
// Mock handles
// ---------------------------------------------------------------------------

const mockSearch = vi.fn();
const mockResolveBatch = vi.fn();
// Also mock the single resolver (used by resolveOwnerHasAiChat for AI_CHAT badge)
const mockResolveSingle = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks — must be defined BEFORE module imports
// ---------------------------------------------------------------------------

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                search: mockSearch
            };
        }),
        SearchHistoryService: vi.fn().mockImplementation(function () {
            return {
                record: vi.fn().mockResolvedValue(undefined)
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
    resolveOwnerEntitlementsForOwnerId: mockResolveSingle,
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
        })),
        isGuestActor: vi.fn(() => true),
        createGuestActor: vi.fn(() => ({
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

vi.mock('../../../../src/routes/accommodation/public/quick-amenity-resolver', () => ({
    resolveQuickAmenityFlags: vi.fn().mockResolvedValue([])
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

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeAccommodation(
    overrides: Partial<{
        id: string;
        slug: string;
        ownerId: string;
        isVerified: boolean;
    }>
): Record<string, unknown> {
    return {
        id: 'acc-default',
        slug: 'default',
        name: 'Test Lodge',
        summary: 'A nice lodge',
        description: 'Plain description',
        type: 'CABIN',
        isFeatured: false,
        isVerified: false,
        averageRating: 4.0,
        reviewsCount: 5,
        media: null,
        price: null,
        location: null,
        seo: null,
        extraInfo: null,
        destinationId: 'dddddddd-0000-4000-8000-000000000001',
        ownerId: OWNER_WITH_BADGE,
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildApp() {
    vi.resetModules();
    const { publicListAccommodationsRoute } = await import(
        '../../../../src/routes/accommodation/public/list'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicListAccommodationsRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publicListAccommodationsRoute — SPEC-291 Phase 3b isVerified badge gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: single resolver returns no AI_CHAT (AI badge stays off)
        mockResolveSingle.mockResolvedValue([]);
    });

    it('preserves isVerified=true when owner HAS HAS_VERIFICATION_BADGE', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({ id: 'acc-1', ownerId: OWNER_WITH_BADGE, isVerified: true })
                ],
                total: 1
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(true);
    });

    it('forces isVerified=false when owner LACKS HAS_VERIFICATION_BADGE', async () => {
        mockResolveBatch.mockResolvedValue(new Map([[OWNER_WITHOUT_BADGE, []]]));
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-2',
                        ownerId: OWNER_WITHOUT_BADGE,
                        isVerified: true
                    })
                ],
                total: 1
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('keeps isVerified=false for un-verified accommodation even if owner HAS the badge', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({ id: 'acc-3', ownerId: OWNER_WITH_BADGE, isVerified: false })
                ],
                total: 1
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(1);
        expect(items[0]?.isVerified).toBe(false);
    });

    it('gates each item independently on a mixed page', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([
                [OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]],
                [OWNER_WITHOUT_BADGE, []]
            ])
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({ id: 'acc-a', ownerId: OWNER_WITH_BADGE, isVerified: true }),
                    makeAccommodation({
                        id: 'acc-b',
                        ownerId: OWNER_WITHOUT_BADGE,
                        isVerified: true
                    }),
                    makeAccommodation({ id: 'acc-c', ownerId: OWNER_WITH_BADGE, isVerified: false })
                ],
                total: 3
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(3);
        // acc-a: owner has badge + verified → true
        expect(items.find((i) => i.id === 'acc-a')?.isVerified).toBe(true);
        // acc-b: owner lacks badge + verified → false
        expect(items.find((i) => i.id === 'acc-b')?.isVerified).toBe(false);
        // acc-c: owner has badge but not verified → false
        expect(items.find((i) => i.id === 'acc-c')?.isVerified).toBe(false);
    });

    it('calls the batch resolver ONCE per request with the unique owner IDs', async () => {
        mockResolveBatch.mockResolvedValue(
            new Map([[OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]]])
        );
        // Three items that share the same owner
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-x1',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    }),
                    makeAccommodation({
                        id: 'acc-x2',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    }),
                    makeAccommodation({
                        id: 'acc-x3',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: false
                    })
                ],
                total: 3
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        // The batch resolver must be called exactly once
        expect(mockResolveBatch).toHaveBeenCalledTimes(1);
        // And with the unique owner IDs (deduplicated)
        const [calledWith] = mockResolveBatch.mock.calls[0] as [string[]];
        expect(calledWith).toHaveLength(1);
        expect(calledWith[0]).toBe(OWNER_WITH_BADGE);
    });

    it('forces isVerified=false when batch resolver returns empty map (all owners absent — fail-closed)', async () => {
        // The real batch resolver never throws — it catches errors internally and
        // returns empty arrays per owner. An empty map simulates the worst-case
        // scenario where the entire batch resolution failed.
        mockResolveBatch.mockResolvedValue(new Map());
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    makeAccommodation({
                        id: 'acc-fail',
                        ownerId: OWNER_WITH_BADGE,
                        isVerified: true
                    })
                ],
                total: 1
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(1);
        // Owner absent from empty map → gate forces isVerified=false
        expect(items[0]?.isVerified).toBe(false);
    });
});
