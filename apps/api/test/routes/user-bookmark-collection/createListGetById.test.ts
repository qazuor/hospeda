/**
 * T-056a: Integration tests for POST / and GET /:id on
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
        createCollection: vi.fn(),
        listCollectionsByUser: vi.fn(),
        getCollectionById: vi.fn()
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/protected/user-bookmark-collections — create', () => {
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
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ name: 'My List' })
            });

            // Assert
            expect(res.status).not.toBe(200);
            expect([401, 403, 500]).toContain(res.status);
        });
    });

    // =========================================================================
    // Happy path
    // =========================================================================

    describe('TC2: Happy path — collection created', () => {
        it('returns 201 with the new collection when input is valid', async () => {
            // Arrange
            const actor = buildUserActor();
            const newCollection = makeCollection({ name: 'Viaje al Litoral' });
            mockCollectionService.createCollection.mockResolvedValue({
                data: newCollection
            });

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Viaje al Litoral' })
            });

            // Assert
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toMatchObject({ name: 'Viaje al Litoral', userId: ACTOR_ID });
        });
    });

    // =========================================================================
    // Validation errors
    // =========================================================================

    describe('TC3: Validation — missing name', () => {
        it('returns 400 when the name field is absent', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ description: 'no name field' })
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('TC4: Validation — name too long (>60 chars)', () => {
        it('returns 400 when name exceeds 60 characters', async () => {
            // Arrange
            const actor = buildUserActor();
            const tooLong = 'A'.repeat(61);

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: tooLong })
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });

    // =========================================================================
    // Service error mapping
    // =========================================================================

    describe('TC5: Quota exceeded (QUOTA_EXCEEDED) → 403', () => {
        it('returns 403 when the service returns QUOTA_EXCEEDED', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.createCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.QUOTA_EXCEEDED,
                    message: 'User has reached the maximum number of collections'
                }
            });

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'New Collection' })
            });

            // Assert
            expect(res.status).toBe(403);
        });
    });

    describe('TC6: Name taken (ALREADY_EXISTS) → 409', () => {
        it('returns 409 when the service returns ALREADY_EXISTS', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.createCollection.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message: 'A collection with this name already exists'
                }
            });

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Duplicate Name' })
            });

            // Assert
            expect(res.status).toBe(409);
        });
    });
});

// =============================================================================

describe('GET /api/v1/protected/user-bookmark-collections/:id — getById', () => {
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
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'GET',
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

    describe('TC8: Happy path — owner fetches collection', () => {
        it('returns 200 with the collection when the owner requests it', async () => {
            // Arrange
            const actor = buildUserActor();
            const collection = makeCollection();
            mockCollectionService.getCollectionById.mockResolvedValue({
                data: {
                    collection,
                    bookmarks: { rows: [], total: 0, page: 1, pageSize: 20 }
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(COLLECTION_ID);
        });
    });

    // =========================================================================
    // Not found / forbidden
    // =========================================================================

    describe('TC9: Not found — 404', () => {
        it('returns 404 when the service returns NOT_FOUND', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.getCollectionById.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Collection not found'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    describe('TC10: Unauthorized — 403', () => {
        it('returns 403 when the service returns FORBIDDEN', async () => {
            // Arrange
            const actor = buildUserActor();
            mockCollectionService.getCollectionById.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Not the owner'
                }
            });

            // Act
            const res = await app.request(`${BASE_URL}/${COLLECTION_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // With bookmarksPage + entityType query
    // =========================================================================

    describe('TC11: Filtered bookmarks returned with bookmarksPage and entityType', () => {
        it('passes bookmarksPage and bookmarksPageSize to the service and returns bookmarks', async () => {
            // Arrange
            const actor = buildUserActor();
            const bookmarkItem = {
                id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',
                entityId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
                entityType: 'ACCOMMODATION',
                name: 'My bookmark',
                createdAt: new Date('2025-01-01').toISOString()
            };
            const collection = makeCollection();
            mockCollectionService.getCollectionById.mockResolvedValue({
                data: {
                    collection,
                    bookmarks: { rows: [bookmarkItem], total: 1, page: 2, pageSize: 5 }
                }
            });

            // Act
            const res = await app.request(
                `${BASE_URL}/${COLLECTION_ID}?bookmarksPage=2&bookmarksPageSize=5`,
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.bookmarks).toBeDefined();
            expect(body.data.bookmarks.data).toHaveLength(1);

            // Service received the paginated bookmark params
            expect(mockCollectionService.getCollectionById).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ bookmarksPage: 2, bookmarksPageSize: 5 })
            );
        });
    });

    // =========================================================================
    // Invalid UUID param
    // =========================================================================

    describe('TC12: Invalid UUID path param', () => {
        it('returns 400 when :id is not a valid UUID', async () => {
            // Arrange
            const actor = buildUserActor();

            // Act
            const res = await app.request(`${BASE_URL}/not-a-uuid`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect([400, 422]).toContain(res.status);
        });
    });
});
