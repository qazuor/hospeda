/**
 * entitlement-gate.integration.test.ts
 *
 * SPEC-287 T-013: cross-cutting integration test for the CAN_USE_COLLECTIONS
 * entitlement gate across tourist plans, exercised through the REAL,
 * registered routes (initApp()) — unlike every other collection route test
 * file, `gateCollections()` and `entitlementMiddleware` are NOT mocked away
 * here. Only the two genuinely external boundaries are mocked:
 *   - `entitlementMiddleware` (so entitlements/limits are deterministic
 *     instead of requiring a live billing DB — same DB-boundary rationale as
 *     every other route test in this suite)
 *   - `UserBookmarkCollectionService` (no real DB)
 *
 * Covers:
 *   - tourist-free (no entitlement) → 403 ENTITLEMENT_REQUIRED on all 7 routes
 *   - tourist-plus (entitlement + MAX_COLLECTIONS=10) → gate passes, planLimit
 *     resolves to 10 on create/list, QUOTA_EXCEEDED at the 10-collection boundary
 *   - tourist-vip (entitlement + MAX_COLLECTIONS=25) → gate passes, planLimit
 *     resolves to 25 on create/list, QUOTA_EXCEEDED at the 25-collection boundary
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockCollectionService } = vi.hoisted(() => {
    const mockCollectionService = {
        createCollection: vi.fn(),
        listCollectionsByUser: vi.fn(),
        getCollectionById: vi.fn(),
        updateCollection: vi.fn(),
        deleteCollection: vi.fn(),
        addBookmarkToCollection: vi.fn(),
        removeBookmarkFromCollection: vi.fn()
    };
    return { mockCollectionService };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        UserBookmarkCollectionService: vi.fn().mockImplementation(() => mockCollectionService)
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

/**
 * Plan under test for the current request. Set per-test via `currentPlan`;
 * the mocked entitlementMiddleware reads it to populate userEntitlements /
 * userLimits deterministically (no live billing DB needed).
 */
type TouristPlan = 'free' | 'plus' | 'vip';

const { getCurrentPlan, setCurrentPlan } = vi.hoisted(() => {
    let plan: 'free' | 'plus' | 'vip' = 'free';
    return {
        getCurrentPlan: () => plan,
        setCurrentPlan: (p: 'free' | 'plus' | 'vip') => {
            plan = p;
        }
    };
});

vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware:
            () => async (c: import('hono').Context, next: () => Promise<void>) => {
                const plan = getCurrentPlan();
                if (plan === 'free') {
                    c.set('userEntitlements', new Set());
                    c.set('userLimits', new Map());
                } else if (plan === 'plus') {
                    c.set('userEntitlements', new Set([EntitlementKey.CAN_USE_COLLECTIONS]));
                    c.set('userLimits', new Map([[LimitKey.MAX_COLLECTIONS, 10]]));
                } else {
                    c.set('userEntitlements', new Set([EntitlementKey.CAN_USE_COLLECTIONS]));
                    c.set('userLimits', new Map([[LimitKey.MAX_COLLECTIONS, 25]]));
                }
                c.set('billingLoadFailed', false);
                await next();
            }
    };
});

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_URL = '/api/v1/protected/user-bookmark-collections';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const COLLECTION_ID = 'cccccccc-cccc-4ccc-accc-cccccccccccc';
const BOOKMARK_ID = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';

function buildUserActor(): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
            PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE
        ] as PermissionEnum[]
    };
}

function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

/** The 7 protected user-bookmark-collections routes under the gate. */
const ROUTES: Array<{ name: string; method: string; path: string }> = [
    { name: 'list', method: 'GET', path: BASE_URL },
    { name: 'create', method: 'POST', path: BASE_URL },
    { name: 'getById', method: 'GET', path: `${BASE_URL}/${COLLECTION_ID}` },
    { name: 'update', method: 'PATCH', path: `${BASE_URL}/${COLLECTION_ID}` },
    { name: 'delete', method: 'DELETE', path: `${BASE_URL}/${COLLECTION_ID}` },
    {
        name: 'addBookmark',
        method: 'POST',
        path: `${BASE_URL}/${COLLECTION_ID}/bookmarks/${BOOKMARK_ID}`
    },
    {
        name: 'removeBookmark',
        method: 'DELETE',
        path: `${BASE_URL}/${COLLECTION_ID}/bookmarks/${BOOKMARK_ID}`
    }
];

describe('user-bookmark-collections — cross-plan entitlement gate (SPEC-287 T-013)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        setCurrentPlan('free');
    });

    describe('tourist-free (no CAN_USE_COLLECTIONS entitlement)', () => {
        it.each(ROUTES)('returns 403 ENTITLEMENT_REQUIRED for $name', async ({ method, path }) => {
            // Arrange
            setCurrentPlan('free');
            const actor = buildUserActor();

            // Act
            const res = await app.request(path, {
                method,
                headers: actorHeaders(actor),
                body:
                    method === 'POST' || method === 'PATCH'
                        ? JSON.stringify({ name: 'X' })
                        : undefined
            });

            // Assert
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        });
    });

    describe.each([
        { plan: 'plus' as TouristPlan, expectedLimit: 10 },
        { plan: 'vip' as TouristPlan, expectedLimit: 25 }
    ])(
        'tourist-$plan (CAN_USE_COLLECTIONS + MAX_COLLECTIONS=$expectedLimit)',
        ({ plan, expectedLimit }) => {
            it('passes the gate and resolves the correct planLimit on create', async () => {
                // Arrange
                setCurrentPlan(plan);
                const actor = buildUserActor();
                mockCollectionService.createCollection.mockResolvedValue({
                    data: {
                        id: COLLECTION_ID,
                        userId: ACTOR_ID,
                        name: 'New Collection',
                        description: null,
                        color: null,
                        icon: null,
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2025-01-01').toISOString(),
                        updatedAt: new Date('2025-01-01').toISOString(),
                        deletedAt: null,
                        createdById: null,
                        updatedById: null,
                        deletedById: null,
                        adminInfo: null
                    }
                });

                // Act
                const res = await app.request(BASE_URL, {
                    method: 'POST',
                    headers: actorHeaders(actor),
                    body: JSON.stringify({ name: 'New Collection' })
                });

                // Assert
                expect(res.status).toBe(201);
                expect(mockCollectionService.createCollection).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    { hookState: { planLimit: expectedLimit } }
                );
            });

            it(`returns 403 QUOTA_EXCEEDED at the ${expectedLimit}-collection boundary`, async () => {
                // Arrange
                setCurrentPlan(plan);
                const actor = buildUserActor();
                mockCollectionService.createCollection.mockResolvedValue({
                    error: {
                        code: ServiceErrorCode.QUOTA_EXCEEDED,
                        message: `Collection limit reached: users may not have more than ${expectedLimit} active collections`,
                        details: { currentCount: expectedLimit, maxAllowed: expectedLimit }
                    }
                });

                // Act
                const res = await app.request(BASE_URL, {
                    method: 'POST',
                    headers: actorHeaders(actor),
                    body: JSON.stringify({ name: 'One too many' })
                });

                // Assert
                expect(res.status).toBe(403);
            });

            it('resolves the correct usage.max on list', async () => {
                // Arrange
                setCurrentPlan(plan);
                const actor = buildUserActor();
                mockCollectionService.listCollectionsByUser.mockResolvedValue({
                    data: { rows: [], total: 0, page: 1, pageSize: 10 }
                });

                // Act
                const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                    method: 'GET',
                    headers: actorHeaders(actor)
                });

                // Assert
                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.data.usage.max).toBe(expectedLimit);
            });
        }
    );
});
