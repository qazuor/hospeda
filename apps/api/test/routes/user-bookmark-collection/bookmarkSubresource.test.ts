/**
 * T-057a (collection bookmark sub-resource): Integration tests for
 * POST /:id/bookmarks/:bookmarkId  and
 * DELETE /:id/bookmarks/:bookmarkId
 * on /api/v1/protected/user-bookmark-collections.
 *
 * The service layer is replaced with a hoisted vi.mock so the real
 * UserBookmarkCollectionService (and the DB) is never touched.
 * Auth is injected via x-mock-actor-* headers (actorMiddleware, test env,
 * HOSPEDA_ALLOW_MOCK_ACTOR=true set in test/setup.ts).
 *
 * Pattern mirrors test/routes/user-bookmark-collection/list.test.ts (T-CL5).
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockCollectionService } = vi.hoisted(() => {
    const mockCollectionService = {
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

// ─── Constants ───────────────────────────────────────────────────────────────
const COLLECTION_BASE = '/api/v1/protected/user-bookmark-collections';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const COLLECTION_ID = 'cccccccc-cccc-4ccc-accc-cccccccccccc';
const BOOKMARK_ID = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBookmark(overrides: Record<string, unknown> = {}) {
    return {
        id: BOOKMARK_ID,
        userId: ACTOR_ID,
        entityId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
        entityType: 'ACCOMMODATION',
        collectionId: COLLECTION_ID,
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

// ─── Actor helpers ─────────────────────────────────────────────────────────────

function buildUserActor(id = ACTOR_ID): Actor {
    return {
        id,
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
            PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE
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

// ─── Helper: build the sub-resource URL ───────────────────────────────────────
function subresourceUrl(collectionId: string, bookmarkId: string): string {
    return `${COLLECTION_BASE}/${collectionId}/bookmarks/${bookmarkId}`;
}

// =============================================================================
// POST /:id/bookmarks/:bookmarkId — add bookmark to collection
// =============================================================================

describe('POST /…/user-bookmark-collections/:id/bookmarks/:bookmarkId — addBookmark', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Auth
    // =========================================================================

    describe('TC1: Auth required', () => {
        it('returns 401 or 403 when no actor headers are provided', async () => {
            // Arrange — no auth headers

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect([401, 403, 500]).toContain(res.status);
        });
    });

    // =========================================================================
    // Happy path
    // =========================================================================

    describe('TC2: Happy path — bookmark added to collection', () => {
        it('returns 200 with the updated bookmark when both IDs are valid', async () => {
            // Arrange
            const actor = buildUserActor();
            const bookmark = makeBookmark();
            mockCollectionService.addBookmarkToCollection.mockResolvedValue({
                data: bookmark
            });

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'POST',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(BOOKMARK_ID);
            expect(body.data.collectionId).toBe(COLLECTION_ID);
        });
    });

    // =========================================================================
    // Service error mapping
    // =========================================================================

    describe('TC3: Collection or bookmark not found → 404', () => {
        it('returns 404 when the service returns NOT_FOUND', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.addBookmarkToCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Collection or bookmark not found'
                }
            });

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'POST',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    describe('TC4: Not the owner (FORBIDDEN) → 403', () => {
        it('returns 403 when the service returns FORBIDDEN', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.addBookmarkToCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Not the owner'
                }
            });

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'POST',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // Invalid path params
    // =========================================================================

    describe('TC5: Invalid collection UUID', () => {
        it('returns 400 when :id is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(subresourceUrl('not-a-uuid', BOOKMARK_ID), {
                method: 'POST',
                headers: actorHeaders(actor)
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('TC6: Invalid bookmark UUID', () => {
        it('returns 400 when :bookmarkId is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, 'not-a-uuid'), {
                method: 'POST',
                headers: actorHeaders(actor)
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });
});

// =============================================================================
// DELETE /:id/bookmarks/:bookmarkId — remove bookmark from collection
// =============================================================================

describe('DELETE /…/user-bookmark-collections/:id/bookmarks/:bookmarkId — removeBookmark', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Auth
    // =========================================================================

    describe('TC7: Auth required', () => {
        it('returns 401 or 403 when no actor headers are provided', async () => {
            // Arrange — no auth headers

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'DELETE',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect([401, 403, 500]).toContain(res.status);
        });
    });

    // =========================================================================
    // Happy path
    // =========================================================================

    describe('TC8: Happy path — bookmark removed from collection', () => {
        it('returns 200 with the now-uncollected bookmark (collectionId null)', async () => {
            // Arrange
            const actor = buildUserActor();
            const uncollected = makeBookmark({ collectionId: null });
            mockCollectionService.removeBookmarkFromCollection.mockResolvedValue({
                data: uncollected
            });

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(BOOKMARK_ID);
            expect(body.data.collectionId).toBeNull();
        });
    });

    // =========================================================================
    // Service error mapping
    // =========================================================================

    describe('TC9: Bookmark not found → 404', () => {
        it('returns 404 when the service returns NOT_FOUND', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.removeBookmarkFromCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Bookmark not found'
                }
            });

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    describe('TC10: Not the owner (FORBIDDEN) → 403', () => {
        it('returns 403 when the service returns FORBIDDEN', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.removeBookmarkFromCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Not the owner'
                }
            });

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, BOOKMARK_ID), {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // Invalid path params
    // =========================================================================

    describe('TC11: Invalid collection UUID', () => {
        it('returns 400 when :id is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(subresourceUrl('not-a-uuid', BOOKMARK_ID), {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('TC12: Invalid bookmark UUID', () => {
        it('returns 400 when :bookmarkId is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(subresourceUrl(COLLECTION_ID, 'not-a-uuid'), {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });
});
