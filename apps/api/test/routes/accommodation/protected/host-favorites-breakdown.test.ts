/**
 * Unit tests for the host favorites per-accommodation breakdown route.
 *
 * SPEC-155 T-005 — GET /api/v1/protected/accommodations/my/favorites-breakdown
 *
 * Verifies:
 *  - Handler returns an array of `{ accommodationId, slug, bookmarkCount }` items.
 *  - Each item's bookmarkCount corresponds to the count returned by
 *    `bookmarkService.countBookmarksForEntity()`.
 *  - Scope isolation: the handler always passes `ownerId = actor.id` to
 *    `accommodationService.list()` — never a different owner's ID.
 *  - Empty result: a host with no accommodations gets an empty array.
 *  - Service error on accommodation list propagates as a thrown ServiceError.
 *
 * Pattern: mock `createProtectedRoute` to capture the raw handler, then invoke
 * it directly. Avoids booting the full Hono application and middleware chain.
 * Follows the admin-stats test (T-012) established in this same codebase.
 *
 * @module test/routes/accommodation/protected/host-favorites-breakdown
 * @see SPEC-155 T-005
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs — available inside vi.mock() factory closures.
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >()
}));

const { mockListAccommodations, mockCountBookmarksForEntity } = vi.hoisted(() => ({
    mockListAccommodations: vi.fn(),
    mockCountBookmarksForEntity: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createProtectedRoute to capture the raw handler without mounting Hono.
vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn(
        (config: {
            path: string;
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedHandlers.set(config.path, config.handler);
            return config.handler;
        }
    )
}));

// Mock actor extraction so tests can control who is performing the request.
vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Mock AccommodationService and UserBookmarkService — no DB calls.
// RoleEnum must be included so entitlement.ts can build STAFF_BILLING_BYPASS_ROLES
// at module-load time (SPEC-145 T-026).
vi.mock('@repo/service-core', () => ({
    AccommodationService: vi.fn(() => ({
        list: mockListAccommodations
    })),
    UserBookmarkService: vi.fn(() => ({
        countBookmarksForEntity: mockCountBookmarksForEntity
    })),
    RoleEnum: {
        SUPER_ADMIN: 'SUPER_ADMIN',
        ADMIN: 'ADMIN',
        CLIENT_MANAGER: 'CLIENT_MANAGER',
        EDITOR: 'EDITOR',
        HOST: 'HOST',
        SPONSOR: 'SPONSOR',
        USER: 'USER',
        GUEST: 'GUEST',
        SYSTEM: 'SYSTEM'
    },
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// Mock plan.service so the module-level `new PlanService()` in entitlement.ts
// does not throw when the route module is imported (SPEC-145 T-026).
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: vi.fn(),
        getBySlug: vi.fn()
    }))
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution — causes createProtectedRoute to be called, which
// stores the handler in capturedHandlers.
await import('../../../../src/routes/accommodation/protected/hostFavoritesBreakdown');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const HOST_ACTOR: Actor = {
    id: 'host-owner-id',
    role: RoleEnum.HOST,
    permissions: []
};

/** Two sample accommodations owned by the host. */
const SAMPLE_ACCOMMODATIONS = [
    { id: 'acc-id-1', slug: 'casa-la-playa', ownerId: HOST_ACTOR.id },
    { id: 'acc-id-2', slug: 'cabaña-rio', ownerId: HOST_ACTOR.id }
];

/**
 * Minimal mock context — the handler only reads the actor via
 * getActorFromContext; it does not call c.json() directly.
 */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for the /my/favorites-breakdown path. */
function getBreakdownHandler(): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get('/my/favorites-breakdown');
    if (!handler) {
        throw new Error('No handler captured for path: /my/favorites-breakdown');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hostFavoritesBreakdownRoute handler — SPEC-155 T-005', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(HOST_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('route registration', () => {
        it('handler is captured for path /my/favorites-breakdown', () => {
            expect(capturedHandlers.has('/my/favorites-breakdown')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path — two accommodations
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns an array of breakdown items — one per accommodation', async () => {
            // Arrange
            mockListAccommodations.mockResolvedValue({
                data: {
                    items: SAMPLE_ACCOMMODATIONS,
                    total: SAMPLE_ACCOMMODATIONS.length
                },
                error: undefined
            });
            mockCountBookmarksForEntity
                .mockResolvedValueOnce({ data: { count: 7 }, error: undefined })
                .mockResolvedValueOnce({ data: { count: 3 }, error: undefined });

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as Array<{
                accommodationId: string;
                slug: string;
                bookmarkCount: number;
            }>;

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                accommodationId: 'acc-id-1',
                slug: 'casa-la-playa',
                bookmarkCount: 7
            });
            expect(result[1]).toEqual({
                accommodationId: 'acc-id-2',
                slug: 'cabaña-rio',
                bookmarkCount: 3
            });
        });

        it('calls accommodationService.list with ownerId = actor.id (scope isolation)', async () => {
            // Arrange
            mockListAccommodations.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — list must be scoped to actor's own id
            expect(mockListAccommodations).toHaveBeenCalledOnce();
            const [, listOptions] = mockListAccommodations.mock.calls[0] ?? [];
            expect((listOptions as { where: { ownerId: string } }).where).toMatchObject({
                ownerId: HOST_ACTOR.id
            });
        });

        it('returns an empty array when the host owns no accommodations', async () => {
            // Arrange
            mockListAccommodations.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual([]);
            expect(mockCountBookmarksForEntity).not.toHaveBeenCalled();
        });

        it('calls countBookmarksForEntity with entityType ACCOMMODATION', async () => {
            // Arrange
            mockListAccommodations.mockResolvedValue({
                data: { items: [SAMPLE_ACCOMMODATIONS[0]], total: 1 },
                error: undefined
            });
            mockCountBookmarksForEntity.mockResolvedValue({
                data: { count: 5 },
                error: undefined
            });

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — entityType must be ACCOMMODATION
            expect(mockCountBookmarksForEntity).toHaveBeenCalledOnce();
            const [, params] = mockCountBookmarksForEntity.mock.calls[0] ?? [];
            expect((params as { entityType: string }).entityType).toBe('ACCOMMODATION');
            expect((params as { entityId: string }).entityId).toBe('acc-id-1');
        });

        it('defaults bookmarkCount to 0 when countBookmarksForEntity returns no data', async () => {
            // Arrange
            mockListAccommodations.mockResolvedValue({
                data: { items: [SAMPLE_ACCOMMODATIONS[0]], total: 1 },
                error: undefined
            });
            // Simulate missing data (e.g., count service returns undefined)
            mockCountBookmarksForEntity.mockResolvedValue({
                data: undefined,
                error: undefined
            });

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as Array<{
                bookmarkCount: number;
            }>;

            // Assert — must not crash, must default to 0
            expect(result[0]?.bookmarkCount).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Error path
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when accommodation list returns an error object', async () => {
            // Arrange
            mockListAccommodations.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
            });

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('DB unavailable');
        });

        it('propagates unexpected thrown errors from accommodation list', async () => {
            // Arrange
            mockListAccommodations.mockRejectedValue(new Error('connection lost'));

            const handler = getBreakdownHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('connection lost');
        });
    });
});
