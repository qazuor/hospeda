/**
 * BETA-42 Regression: bookmark toggle-OFF at cap must NOT be blocked.
 *
 * Before the fix, `enforceFavoritesLimit()` ran as a route middleware so it
 * fired BEFORE the handler determined whether the toggle was adding or
 * removing a bookmark.  A user sitting exactly at their MAX_FAVORITES cap
 * received 403 LIMIT_REACHED even when trying to un-favorite (toggle-off)
 * an existing entry, leaving them permanently stuck.
 *
 * After the fix, `assertFavoritesLimitOrThrow` is called from inside the
 * handler only in the toggle-ON branch (bookmark does NOT yet exist).  The
 * toggle-OFF branch (existing bookmark → softDelete) never hits the limit.
 *
 * Three assertions are exercised here:
 *   1. Toggle-OFF at cap → succeeds, returns {toggled:false, bookmark:null}
 *   2. Toggle-ON  at cap → 403 LIMIT_REACHED
 *   3. Toggle-ON  under cap → succeeds, returns {toggled:true, bookmark:{…}}
 *
 * Strategy:
 *  - initApp() mounts the full Hono app so the real route + handler + limit
 *    logic is exercised (no hand-rolled stub).
 *  - vi.hoisted + vi.mock override UserBookmarkService so no real DB is hit.
 *  - gateFavorites (SAVE_FAVORITES entitlement gate) is mocked to always
 *    call next() — entitlement gating is tested elsewhere; here we focus on
 *    the limit-enforcement regression.
 *  - getRemainingLimit (the function that reads userLimits from context) is
 *    mocked at the module level to return a fixed cap of 3, which means
 *    countBookmarksForUser returning 3 → "at cap".
 *  - Auth is injected via x-mock-actor-* headers (HOSPEDA_ALLOW_MOCK_ACTOR=true
 *    and HOSPEDA_DISABLE_AUTH=true are set in test/setup.ts).
 */

import { LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = '/api/v1/protected/user-bookmarks';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ENTITY_ID = 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee';
const ENTITY_TYPE = 'ACCOMMODATION';
const BOOKMARK_ID = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';

/** MAX_FAVORITES cap used across these tests. */
const MAX_FAVORITES = 3;

// ---------------------------------------------------------------------------
// Hoisted mock references — must be created before any import is resolved.
// ---------------------------------------------------------------------------

const { mockBookmarkService } = vi.hoisted(() => {
    const mockBookmarkService = {
        findExistingBookmark: vi.fn(),
        softDelete: vi.fn(),
        create: vi.fn(),
        countBookmarksForUser: vi.fn()
    };
    return { mockBookmarkService };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Override UserBookmarkService in @repo/service-core so the test controls
 * exactly what findExistingBookmark / softDelete / create / countBookmarksForUser
 * return without touching the real DB.
 *
 * All other service-core exports (types, enums, ServiceError, etc.) are
 * passed through from the real module via spread so instanceof checks work.
 */
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        UserBookmarkService: vi.fn().mockImplementation(() => mockBookmarkService)
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
 * Mock gateFavorites (SAVE_FAVORITES entitlement gate) to always pass through.
 * Entitlement gating is already tested by tourist-entitlements.test.ts; here
 * we only care about the limit-enforcement regression.
 */
vi.mock('../../../src/middlewares/tourist-entitlements', () => ({
    gateFavorites: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

/**
 * Mock getRemainingLimit so that checkLimit() → assertFavoritesLimitOrThrow()
 * sees MAX_FAVORITES = 3 without needing the entitlement middleware to inject
 * userLimits into the Hono context.
 *
 * The real function reads from c.get('userLimits') which is populated by the
 * billing entitlement middleware at runtime.  In tests we bypass that middleware
 * and control the return value directly.
 */
vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        getRemainingLimit: (_c: unknown, limitKey: string) => {
            if (limitKey === LimitKey.MAX_FAVORITES) {
                return MAX_FAVORITES;
            }
            return -1; // unlimited for other keys
        }
    };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBookmark(overrides: Record<string, unknown> = {}) {
    return {
        id: BOOKMARK_ID,
        userId: ACTOR_ID,
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
        adminInfo: null,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

function buildUserActor(id = ACTOR_ID): Actor {
    return {
        id,
        role: RoleEnum.USER,
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
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

function makeToggleBody(entityId = ENTITY_ID, entityType = ENTITY_TYPE): string {
    return JSON.stringify({ entityId, entityType });
}

// ---------------------------------------------------------------------------
// Tests — BETA-42 regression
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/user-bookmarks — BETA-42 toggle-at-cap regression', () => {
    let app: AppOpenAPI;
    const actor = buildUserActor();

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // 1. Toggle-OFF at cap is NOT blocked (the core regression)
    // =========================================================================

    it('REGRESSION BETA-42: toggle-OFF when at cap succeeds and removes the bookmark', async () => {
        // Arrange — bookmark already exists (toggle-off branch)
        mockBookmarkService.findExistingBookmark.mockResolvedValue({
            data: makeBookmark()
        });
        mockBookmarkService.softDelete.mockResolvedValue({
            data: { id: BOOKMARK_ID }
        });
        // countBookmarksForUser returns cap value — simulates user AT the limit.
        // This mock must NOT be reached in the toggle-off branch (the handler
        // returns before calling assertFavoritesLimitOrThrow).
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: { count: MAX_FAVORITES }
        });

        // Act
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        // Assert — must be 200 or 201 (not 403). POST routes in this API
        // return 201; accepting both makes the test robust across factory variants.
        expect([200, 201]).toContain(res.status);

        const body = await res.json();
        // The response envelope: { success: true, data: { toggled: false, bookmark: null } }
        expect(body.success).toBe(true);
        expect(body.data.toggled).toBe(false);
        expect(body.data.bookmark).toBeNull();

        // softDelete must have been called — bookmark was removed
        expect(mockBookmarkService.softDelete).toHaveBeenCalledWith(
            expect.objectContaining({ id: actor.id }),
            BOOKMARK_ID
        );

        // countBookmarksForUser must NOT have been called — limit check is
        // skipped entirely in the toggle-off branch (the regression fix).
        expect(mockBookmarkService.countBookmarksForUser).not.toHaveBeenCalled();
    });

    // =========================================================================
    // 2. Toggle-ON at cap IS blocked
    // =========================================================================

    it('toggle-ON when at cap returns 403 LIMIT_REACHED', async () => {
        // Arrange — no existing bookmark (toggle-on branch)
        mockBookmarkService.findExistingBookmark.mockResolvedValue({
            data: null
        });
        // countBookmarksForUser returns cap value — user is at MAX_FAVORITES
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: { count: MAX_FAVORITES }
        });
        // create should NOT be called
        mockBookmarkService.create.mockResolvedValue({
            data: makeBookmark()
        });

        // Act
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        // Assert — limit reached → 403
        expect(res.status).toBe(403);

        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);

        // create must NOT have been called — request was blocked before reaching it
        expect(mockBookmarkService.create).not.toHaveBeenCalled();

        // countBookmarksForUser WAS called (the limit assertion runs in toggle-on)
        expect(mockBookmarkService.countBookmarksForUser).toHaveBeenCalledWith(
            expect.objectContaining({ id: actor.id }),
            expect.objectContaining({ userId: actor.id })
        );
    });

    // =========================================================================
    // 3. Toggle-ON under cap succeeds
    // =========================================================================

    it('toggle-ON when under cap creates the bookmark and returns {toggled:true}', async () => {
        // Arrange — no existing bookmark, user has 2 of 3 max favorites
        mockBookmarkService.findExistingBookmark.mockResolvedValue({
            data: null
        });
        mockBookmarkService.countBookmarksForUser.mockResolvedValue({
            data: { count: MAX_FAVORITES - 1 } // under cap
        });
        mockBookmarkService.create.mockResolvedValue({
            data: makeBookmark()
        });

        // Act
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders(actor),
            body: makeToggleBody()
        });

        // Assert — bookmark created → 200 or 201 (POST routes in this API return 201)
        expect([200, 201]).toContain(res.status);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.toggled).toBe(true);
        expect(body.data.bookmark).not.toBeNull();
        expect(body.data.bookmark.id).toBe(BOOKMARK_ID);

        // create was called with the merged userId from actor
        expect(mockBookmarkService.create).toHaveBeenCalledWith(
            expect.objectContaining({ id: actor.id }),
            expect.objectContaining({
                entityId: ENTITY_ID,
                entityType: ENTITY_TYPE,
                userId: actor.id
            })
        );
    });
});
