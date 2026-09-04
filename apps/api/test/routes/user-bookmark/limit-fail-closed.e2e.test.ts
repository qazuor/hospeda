/**
 * The favorites cap REFUSES when it cannot count, asserted END-TO-END
 * (HOS-1087).
 *
 * ---
 * WHY THIS FILE IS A REQUEST TEST AND NOT A UNIT TEST
 *
 * HOS-973 R-2 (already proven by `accommodation-limit-fail-closed.e2e.test.ts`
 * and `owner-promotion/protected/limit-fail-closed.e2e.test.ts`): every key
 * and every cap is asserted end to end against the real route. A fabricated
 * context always answers green — which is exactly how
 * `assertFavoritesLimitOrThrow`'s inner catch/`else if` kept `currentCount = 0`
 * and let `checkLimit` wave the request through on any count failure, while
 * the suite stayed green.
 *
 * Follows the same isolation pattern as `toggleAtCap.test.ts`: `getRemainingLimit`
 * is stubbed directly to control MAX_FAVORITES without wiring the full
 * billing/plan chain, and `gateFavorites` is stubbed to pass through.
 *
 * ## The decisive assertion is the create call, not the status
 *
 * Each refusal case asserts `UserBookmarkService.create` was never called —
 * the actual product statement: a favorite is not granted when the cap could
 * not be evaluated.
 *
 * @module test/routes/user-bookmark/limit-fail-closed.e2e
 */

import { LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_URL = '/api/v1/protected/user-bookmarks';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ENTITY_ID = 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee';
const ENTITY_TYPE = 'ACCOMMODATION';

/** MAX_FAVORITES cap used across the finite-cap tests. */
const MAX_FAVORITES = 5;

const { mockBookmarkService } = vi.hoisted(() => {
    const mockBookmarkService = {
        findExistingBookmark: vi.fn(),
        softDelete: vi.fn(),
        create: vi.fn(),
        countBookmarksForUser: vi.fn()
    };
    return { mockBookmarkService };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        UserBookmarkService: vi.fn().mockImplementation(function () {
            return mockBookmarkService;
        })
    };
});

vi.mock('../../../src/middlewares/tourist-entitlements', () => ({
    gateFavorites: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    gateComparator: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    gateSearchHistory: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    gateRecommendations: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    gateCollections: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    gateAlerts: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    gateExclusiveDeals: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

/** Mutable so the "unlimited plan" test can flip it without a second module mock. */
let maxFavorites: number = MAX_FAVORITES;
vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        getRemainingLimit: (_c: unknown, limitKey: string) => {
            if (limitKey === LimitKey.MAX_FAVORITES) {
                return maxFavorites;
            }
            return -1;
        }
    };
});

import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

function buildUserActor(id = ACTOR_ID): Actor {
    return {
        id,
        roles: [RoleEnum.USER],
        permissions: [
            PermissionEnum.USER_BOOKMARK_CREATE,
            PermissionEnum.USER_BOOKMARK_DELETE
        ] as PermissionEnum[]
    };
}

function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.roles.join(','),
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

function makeToggleBody(): string {
    return JSON.stringify({ entityId: ENTITY_ID, entityType: ENTITY_TYPE });
}

describe('favorites cap fails CLOSED on a count failure (HOS-1087)', () => {
    let app: AppOpenAPI;
    const actor = buildUserActor();

    beforeEach(() => {
        vi.clearAllMocks();
        maxFavorites = MAX_FAVORITES;
        app = initApp();
        // Toggle-ON branch: no existing bookmark.
        mockBookmarkService.findExistingBookmark.mockResolvedValue({ data: null });
        // Full shape (matching `toggleAtCap.test.ts`'s `makeBookmark()`) — the
        // response-schema strip throws a 500 on a partial object, which would
        // make the "still creates" assertions unreadable (500 instead of 200/201).
        mockBookmarkService.create.mockResolvedValue({
            data: {
                id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',
                userId: actor.id,
                entityId: ENTITY_ID,
                entityType: ENTITY_TYPE,
                collectionId: null,
                name: null,
                description: null,
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
    });

    it('answers 403 LIMIT_REACHED and creates nothing when the count fails (Result error)', async () => {
        // The `Result`-shaped failure — the `else if (countResult.error)`
        // branch used to log a warning and leave `currentCount = 0`.
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: undefined,
            error: { code: 'INTERNAL_ERROR', message: 'connection terminated unexpectedly' }
        });

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        expect(mockBookmarkService.create).not.toHaveBeenCalled();
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);
    });

    it('answers 403 LIMIT_REACHED and creates nothing when the count THROWS', async () => {
        // The thrown-error catch — used to log a warning and continue with 0.
        mockBookmarkService.countBookmarksForUser.mockRejectedValue(
            new Error('connection terminated unexpectedly')
        );

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        expect(mockBookmarkService.create).not.toHaveBeenCalled();
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);
    });

    it('still lets an under-cap create through (non-vacuity)', async () => {
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: { count: MAX_FAVORITES - 1 }
        });

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        expect([200, 201]).toContain(res.status);
        expect(mockBookmarkService.create).toHaveBeenCalledTimes(1);
    });

    it('still answers 403 LIMIT_REACHED when the REAL cap is reached, not just on failure', async () => {
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: { count: MAX_FAVORITES }
        });

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);
        expect(mockBookmarkService.create).not.toHaveBeenCalled();
    });

    it('an UNLIMITED plan (maxAllowed = -1) still creates when the count fails — the -1 short-circuit must run BEFORE the fail-closed sentinel is compared', async () => {
        maxFavorites = -1; // every host plan grants unlimited favorites
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: undefined,
            error: { code: 'INTERNAL_ERROR', message: 'connection terminated unexpectedly' }
        });

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        // This is the regression the fix must not introduce: a fail-closed
        // sentinel count compared BEFORE checkLimit's -1 branch would block
        // every host from favoriting the instant a count hiccups.
        expect([200, 201]).toContain(res.status);
        expect(mockBookmarkService.create).toHaveBeenCalledTimes(1);
    });
});
