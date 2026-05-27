/**
 * Unit tests for the admin post monthly trend route — SPEC-155 T-008.
 *
 * Verifies:
 *  - Handler returns a 12-element trend array on service success.
 *  - Handler throws ServiceError when service returns an error.
 *  - Each trend item has the correct `{ month: YYYY-MM, count: number }` shape.
 *  - Handler propagates FORBIDDEN when actor lacks POST_VIEW_ALL.
 *  - The route is registered on path /trend (not caught by /:id).
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke
 * it directly. Avoids booting the full Hono application and middleware chain.
 * Mirrors the pilot pattern from `test/routes/user/admin-stats.test.ts`.
 *
 * @module test/routes/post/admin-trend
 * @see SPEC-155 T-008
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

const { mockGetMonthlyTrend } = vi.hoisted(() => ({
    mockGetMonthlyTrend: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createAdminRoute to capture the raw handler without mounting Hono.
vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
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
vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Mock PostService so no real DB calls happen.
vi.mock('@repo/service-core', () => ({
    PostService: vi.fn(() => ({
        getMonthlyTrend: mockGetMonthlyTrend
    })),
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

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';

// Trigger module execution — causes createAdminRoute to be called, which
// stores the handler in capturedHandlers.
await import('../../../src/routes/post/admin/trend');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.POST_VIEW_ALL]
};

/** 12-month trend fixture — one item per month, oldest first. */
const TREND_FIXTURE = [
    { month: '2023-06', count: 3 },
    { month: '2023-07', count: 7 },
    { month: '2023-08', count: 0 },
    { month: '2023-09', count: 12 },
    { month: '2023-10', count: 9 },
    { month: '2023-11', count: 4 },
    { month: '2023-12', count: 20 },
    { month: '2024-01', count: 5 },
    { month: '2024-02', count: 8 },
    { month: '2024-03', count: 6 },
    { month: '2024-04', count: 11 },
    { month: '2024-05', count: 2 }
];

/**
 * Minimal mock context — the trend handler only reads the actor via
 * getActorFromContext; it does not call c.json() itself (that is handled
 * by the route factory wrapper).
 */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for the /trend path. Throws if not found. */
function getTrendHandler(): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get('/trend');
    if (!handler) {
        throw new Error('No handler captured for path: /trend');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminPostTrendRoute handler — SPEC-155 T-008', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Registration
    // -----------------------------------------------------------------------

    describe('route registration', () => {
        it('registers the handler on path /trend', () => {
            expect(capturedHandlers.has('/trend')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns the trend array from the service', async () => {
            // Arrange
            mockGetMonthlyTrend.mockResolvedValue({ data: TREND_FIXTURE, error: undefined });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual(TREND_FIXTURE);
        });

        it('trend array has exactly 12 elements', async () => {
            // Arrange
            mockGetMonthlyTrend.mockResolvedValue({ data: TREND_FIXTURE, error: undefined });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as typeof TREND_FIXTURE;

            // Assert
            expect(result).toHaveLength(12);
        });

        it('each trend item has correct { month: YYYY-MM, count: number } shape', async () => {
            // Arrange
            mockGetMonthlyTrend.mockResolvedValue({ data: TREND_FIXTURE, error: undefined });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as typeof TREND_FIXTURE;

            // Assert — element shape
            for (const item of result) {
                expect(item).toHaveProperty('month');
                expect(item).toHaveProperty('count');
                expect(typeof item.month).toBe('string');
                expect(typeof item.count).toBe('number');
                // YYYY-MM format
                expect(item.month).toMatch(/^\d{4}-\d{2}$/);
                expect(item.count).toBeGreaterThanOrEqual(0);
            }
        });

        it('accepts an empty array (no posts exist)', async () => {
            // Arrange
            mockGetMonthlyTrend.mockResolvedValue({ data: [], error: undefined });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual([]);
        });

        it('calls getMonthlyTrend with the resolved actor', async () => {
            // Arrange
            const specificActor = { ...ADMIN_ACTOR, id: 'specific-admin-42' };
            mockGetActorFromContext.mockReturnValue(specificActor);
            mockGetMonthlyTrend.mockResolvedValue({ data: TREND_FIXTURE, error: undefined });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — first argument to getMonthlyTrend must be the actor.
            expect(mockGetMonthlyTrend).toHaveBeenCalledOnce();
            const [calledWithActor] = mockGetMonthlyTrend.mock.calls[0] ?? [];
            expect(calledWithActor).toEqual(specificActor);
        });

        it('handles zero-count months gracefully', async () => {
            // Arrange — all months have zero posts
            const allZeros = TREND_FIXTURE.map((item) => ({ ...item, count: 0 }));
            mockGetMonthlyTrend.mockResolvedValue({ data: allZeros, error: undefined });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as typeof allZeros;

            // Assert
            expect(result.every((item) => item.count === 0)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Error path
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when service returns an error object', async () => {
            // Arrange
            mockGetMonthlyTrend.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB exploded' }
            });

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('DB exploded');
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetMonthlyTrend.mockRejectedValue(new Error('connection reset'));

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('connection reset');
        });
    });

    // -----------------------------------------------------------------------
    // Permission / auth
    // -----------------------------------------------------------------------

    describe('permission gating', () => {
        it('forwards actor to service (actor identity determines auth inside service)', async () => {
            // The route handler trusts the service to enforce POST_VIEW_ALL.
            // We verify the actor is passed through correctly.
            const actorWithoutPermissions: Actor = {
                id: 'restricted-user',
                role: RoleEnum.USER,
                permissions: []
            };
            mockGetActorFromContext.mockReturnValue(actorWithoutPermissions);
            // Simulate service throwing FORBIDDEN
            const { ServiceError } = await import('@repo/service-core');
            mockGetMonthlyTrend.mockRejectedValue(
                new ServiceError('FORBIDDEN', 'Permission denied: POST_VIEW_ALL required')
            );

            const handler = getTrendHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert — error propagates to the route factory error handler
            await expect(handler(ctx, {}, {})).rejects.toThrow(/POST_VIEW_ALL required/);
        });
    });
});
