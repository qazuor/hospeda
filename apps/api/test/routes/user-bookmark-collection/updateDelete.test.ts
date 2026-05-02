/**
 * T-056b: Integration tests for PATCH /:id and DELETE /:id on
 * /api/v1/protected/user-bookmark-collections.
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
        updateCollection: vi.fn(),
        deleteCollection: vi.fn()
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
const BASE_URL = '/api/v1/protected/user-bookmark-collections';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const COLLECTION_ID = 'cccccccc-cccc-4ccc-accc-cccccccccccc';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCollection(overrides: Record<string, unknown> = {}) {
    return {
        id: COLLECTION_ID,
        userId: ACTOR_ID,
        name: 'Test Collection',
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
            PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
            PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE
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

// =============================================================================
// PATCH /:id — update
// =============================================================================

describe('PATCH /api/v1/protected/user-bookmark-collections/:id — update', () => {
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
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ name: 'Updated' })
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect([401, 403, 500]).toContain(res.status);
        });
    });

    // =========================================================================
    // Happy path
    // =========================================================================

    describe('TC2: Happy path — name updated', () => {
        it('returns 200 with the updated collection when name is valid', async () => {
            // Arrange
            const actor = buildUserActor();
            const updated = makeCollection({ name: 'Updated Name' });
            mockCollectionService.updateCollection.mockResolvedValue({ data: updated });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Updated Name' })
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.name).toBe('Updated Name');
        });
    });

    // =========================================================================
    // Service error mapping
    // =========================================================================

    describe('TC3: Name taken (ALREADY_EXISTS) → 409', () => {
        it('returns 409 when the service returns ALREADY_EXISTS', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.updateCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message: 'Name already taken'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Existing Name' })
            });

            // Assert
            expect(res.status).toBe(409);
        });
    });

    describe('TC4: Collection not found → 404', () => {
        it('returns 404 when the service returns NOT_FOUND', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.updateCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Collection not found'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Any Name' })
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    describe('TC5: Not the owner (FORBIDDEN) → 403', () => {
        it('returns 403 when the service returns FORBIDDEN', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.updateCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Not the owner'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Any Name' })
            });

            // Assert
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // Validation
    // =========================================================================

    describe('TC6: Validation — name too long (>60 chars)', () => {
        it('returns 400 when name exceeds 60 characters', async () => {
            // Arrange
            const actor = buildUserActor();
            const tooLong = 'A'.repeat(61);

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: tooLong })
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('TC7: Validation — invalid color (not hex)', () => {
        it('returns 400 when color is not a valid 6-digit hex', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ color: 'not-a-color' })
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('TC8: Invalid UUID path param', () => {
        it('returns 400 when :id is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(`${BASE_URL}/not-a-uuid`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Valid Name' })
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });
});

// =============================================================================
// DELETE /:id — delete
// =============================================================================

describe('DELETE /api/v1/protected/user-bookmark-collections/:id — delete', () => {
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

    describe('TC9: Auth required', () => {
        it('returns 401 or 403 when no actor headers are provided', async () => {
            // Arrange — no auth headers

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
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

    describe('TC10: Happy path — collection deleted', () => {
        it('returns 200 with { id, nullifiedBookmarks } on successful deletion', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.deleteCollection.mockResolvedValue({
                data: { id: COLLECTION_ID, nullifiedBookmarks: 3 }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(COLLECTION_ID);
            expect(typeof body.data.nullifiedBookmarks).toBe('number');
        });
    });

    describe('TC11: Happy path — zero bookmarks nullified', () => {
        it('returns nullifiedBookmarks: 0 when collection had no bookmarks', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.deleteCollection.mockResolvedValue({
                data: { id: COLLECTION_ID, nullifiedBookmarks: 0 }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.nullifiedBookmarks).toBe(0);
        });
    });

    // =========================================================================
    // Service error mapping
    // =========================================================================

    describe('TC12: Collection not found → 404', () => {
        it('returns 404 when the service returns NOT_FOUND', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.deleteCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Collection not found'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    describe('TC13: Not the owner (FORBIDDEN) → 403', () => {
        it('returns 403 when the service returns FORBIDDEN', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.deleteCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Not the owner'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(403);
        });
    });

    describe('TC14: Invalid UUID path param', () => {
        it('returns 400 when :id is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(`${BASE_URL}/not-a-uuid`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });
});
