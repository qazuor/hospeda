/**
 * Integration tests for GET /api/v1/protected/user-bookmark-collections
 *
 * Focuses on the `usage` block returned in the response:
 *   { items, total, page, pageSize, usage: { current: number, max: number } }
 *
 * The service layer is mocked via vi.hoisted + vi.mock so that:
 * - Auth is injected through x-mock-actor-* headers (actorMiddleware, test env only,
 *   requires HOSPEDA_ALLOW_MOCK_ACTOR=true which is set in test/setup.ts).
 * - The service mock controls how many collections are "in the DB" without a real DB.
 * - vi.stubEnv() is used for HOSPEDA_MAX_COLLECTIONS_PER_USER env var tests.
 *
 * Pattern: test/routes/tag/quota.test.ts (SPEC-086 T-043).
 * Global setup.ts already mocks @repo/db and the base @repo/service-core; we
 * override only UserBookmarkCollectionService here.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
// vi.hoisted runs before module imports so the mock factory has the fn references
// before @repo/service-core is resolved.

const { mockCollectionService } = vi.hoisted(() => {
    const mockCollectionService = {
        listCollectionsByUser: vi.fn()
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

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/protected/user-bookmark-collections';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const DEFAULT_MAX = 10;

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeCollection(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
        userId: ACTOR_ID,
        name: 'Test Collection',
        description: null,
        color: null,
        icon: null,
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
        bookmarkCount: 0,
        ...overrides
    };
}

function makeCollections(count: number, withBookmarkCount = false) {
    return Array.from({ length: count }, (_, i) =>
        makeCollection({
            id: `cccccccc-cccc-4ccc-accc-cccccccc${String(i).padStart(4, '0')}`,
            name: `Collection ${i + 1}`,
            bookmarkCount: withBookmarkCount ? i * 2 : 0
        })
    );
}

// ─── Actor helpers ─────────────────────────────────────────────────────────────

function buildUserActor(id = ACTOR_ID): Actor {
    return {
        id,
        role: RoleEnum.USER,
        // USER_BOOKMARK_COLLECTION_VIEW is the correct permission (VIEW_OWN does not exist)
        permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW] as PermissionEnum[]
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

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/protected/user-bookmark-collections — usage block', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    // =========================================================================
    // TC1 — Auth required
    // =========================================================================

    describe('TC1: Auth required', () => {
        it('returns 401 or 403 when no actor headers are provided', async () => {
            // Arrange — no auth headers, HOSPEDA_DISABLE_AUTH=true means a guest
            // actor is created; the protected route rejects non-authenticated actors

            // Act
            const res = await app.request(BASE_URL, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // Assert — route must not return 200 for unauthenticated requests
            expect(res.status).not.toBe(200);
            expect([401, 403, 500]).toContain(res.status);
        });
    });

    // =========================================================================
    // TC2 — Empty state
    // =========================================================================

    describe('TC2: Empty state — 0 collections', () => {
        it('returns items:[], total:0, usage:{current:0, max:10}', async () => {
            // Arrange
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
            expect(body.success).toBe(true);

            const { data } = body;
            expect(data.items).toEqual([]);
            expect(data.total).toBe(0);
            expect(data.usage.current).toBe(0);
            expect(data.usage.max).toBe(DEFAULT_MAX);
        });
    });

    // =========================================================================
    // TC3 — With items
    // =========================================================================

    describe('TC3: User has 3 collections', () => {
        it('returns 3 items, total 3, usage.current 3, usage.max 10', async () => {
            // Arrange
            const actor = buildUserActor();
            const collections = makeCollections(3);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: collections, total: 3, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);

            const { data } = body;
            expect(data.items).toHaveLength(3);
            expect(data.total).toBe(3);
            expect(data.usage.current).toBe(3);
            expect(data.usage.max).toBe(DEFAULT_MAX);
        });
    });

    // =========================================================================
    // TC4 — Pagination
    // =========================================================================

    describe('TC4: Pagination — 15 collections, page=1, pageSize=10', () => {
        it('returns 10 items for page 1, total 15, usage.current 15', async () => {
            // Arrange
            const actor = buildUserActor();
            const pageOfCollections = makeCollections(10);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: pageOfCollections, total: 15, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            const { data } = body;

            expect(data.items).toHaveLength(10);
            expect(data.total).toBe(15);
            expect(data.page).toBe(1);
            expect(data.pageSize).toBe(10);
            expect(data.usage.current).toBe(15);
            expect(data.usage.max).toBe(DEFAULT_MAX);
        });
    });

    // =========================================================================
    // TC5 — Env override: HOSPEDA_MAX_COLLECTIONS_PER_USER=5
    // =========================================================================

    describe('TC5: Env override — HOSPEDA_MAX_COLLECTIONS_PER_USER=5', () => {
        it('usage.max equals 5 when env var is set to 5', async () => {
            // Arrange
            vi.stubEnv('HOSPEDA_MAX_COLLECTIONS_PER_USER', '5');
            const actor = buildUserActor();
            const collections = makeCollections(4);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: collections, total: 4, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.usage.max).toBe(5);
            expect(body.data.usage.current).toBe(4);
        });
    });

    // =========================================================================
    // TC6 — At limit
    // =========================================================================

    describe('TC6: At limit — user has max collections', () => {
        it('returns 200 with usage.current === usage.max when user has 10 of 10', async () => {
            // Arrange
            const actor = buildUserActor();
            const collections = makeCollections(10);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: collections, total: 10, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            const { usage } = body.data;

            expect(usage.current).toBe(DEFAULT_MAX);
            expect(usage.max).toBe(DEFAULT_MAX);
            expect(usage.current).toBe(usage.max);
        });
    });

    // =========================================================================
    // TC7 — Soft-deleted excluded
    // =========================================================================

    describe('TC7: Soft-deleted collections excluded from totals', () => {
        it('total and usage.current reflect only active collections', async () => {
            // Arrange — service returns only the 5 active ones (soft-deleted filtered at model)
            const actor = buildUserActor();
            const activeCollections = makeCollections(5);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: activeCollections, total: 5, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            const { data } = body;

            // Only 5 active, not 8 total (5 active + 3 soft-deleted)
            expect(data.total).toBe(5);
            expect(data.items).toHaveLength(5);
            expect(data.usage.current).toBe(5);
        });
    });

    // =========================================================================
    // TC8 — includeBookmarkCount=true
    // =========================================================================

    describe('TC8: includeBookmarkCount=true — items carry bookmarkCount', () => {
        it('each item has a numeric bookmarkCount field', async () => {
            // Arrange
            const actor = buildUserActor();
            const collectionsWithCount = makeCollections(2, true);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: collectionsWithCount, total: 2, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(
                `${BASE_URL}?page=1&pageSize=10&includeBookmarkCount=true`,
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();

            for (const item of body.data.items) {
                expect(typeof item.bookmarkCount).toBe('number');
            }
            // service was called with includeBookmarkCount=true
            expect(mockCollectionService.listCollectionsByUser).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ includeBookmarkCount: true })
            );
        });
    });

    // =========================================================================
    // TC9 — includeBookmarkCount=false (default)
    // =========================================================================

    describe('TC9: includeBookmarkCount=false (default) — bookmarkCount absent or 0', () => {
        it('service is called with includeBookmarkCount=false when param is omitted', async () => {
            // Arrange
            const actor = buildUserActor();
            const collections = makeCollections(2, false);
            mockCollectionService.listCollectionsByUser.mockResolvedValue({
                data: { rows: collections, total: 2, page: 1, pageSize: 10 }
            });

            // Act
            const res = await app.request(`${BASE_URL}?page=1&pageSize=10`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).toBe(200);
            // service received includeBookmarkCount=false
            expect(mockCollectionService.listCollectionsByUser).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ includeBookmarkCount: false })
            );
        });
    });
});
