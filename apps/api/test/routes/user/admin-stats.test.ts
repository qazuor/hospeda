/**
 * Unit tests for the admin user stats route — SPEC-155 T-012.
 *
 * Verifies:
 *  - Handler returns `{ byRole, newUsersTrend }` on service success.
 *  - Handler throws ServiceError when service returns an error.
 *  - Handler propagates FORBIDDEN when actor lacks USER_READ_ALL.
 *  - newUsersTrend array elements have the correct shape.
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke
 * it directly. Avoids booting the full Hono application and middleware chain.
 *
 * @module test/routes/user/admin-stats
 * @see SPEC-155 T-012
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

const { mockGetAdminStats } = vi.hoisted(() => ({
    mockGetAdminStats: vi.fn()
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

// Mock UserService so no real DB calls happen.
vi.mock('@repo/service-core', () => ({
    UserService: vi.fn(() => ({
        getAdminStats: mockGetAdminStats
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
await import('../../../src/routes/user/admin/stats');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.USER_READ_ALL]
};

/**
 * Minimal mock context — the stats handler only reads the actor via
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

/** Retrieve the captured handler for the /stats path. Throws if not found. */
function getStatsHandler(): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get('/stats');
    if (!handler) {
        throw new Error('No handler captured for path: /stats');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminUserStatsRoute handler — SPEC-155 T-012', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns the byRole map from the service', async () => {
            // Arrange
            const serviceData = {
                byRole: { ADMIN: 2, USER: 150, HOST: 30 },
                newUsersTrend: [
                    { month: '2024-01', count: 5 },
                    { month: '2024-02', count: 8 }
                ]
            };
            mockGetAdminStats.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual(serviceData);
            expect((result as typeof serviceData).byRole).toMatchObject({ ADMIN: 2, USER: 150 });
        });

        it('returns the newUsersTrend array from the service', async () => {
            // Arrange
            const trend = [
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
            mockGetAdminStats.mockResolvedValue({
                data: { byRole: {}, newUsersTrend: trend },
                error: undefined
            });

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                byRole: unknown;
                newUsersTrend: typeof trend;
            };

            // Assert — trend has correct length and element shape
            expect(result.newUsersTrend).toHaveLength(12);
            for (const item of result.newUsersTrend) {
                expect(item).toHaveProperty('month');
                expect(item).toHaveProperty('count');
                expect(typeof item.month).toBe('string');
                expect(typeof item.count).toBe('number');
                // YYYY-MM format
                expect(item.month).toMatch(/^\d{4}-\d{2}$/);
            }
        });

        it('calls getAdminStats with the resolved actor', async () => {
            // Arrange
            const specificActor = { ...ADMIN_ACTOR, id: 'specific-admin-99' };
            mockGetActorFromContext.mockReturnValue(specificActor);
            mockGetAdminStats.mockResolvedValue({
                data: { byRole: {}, newUsersTrend: [] },
                error: undefined
            });

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — first argument to getAdminStats must be the actor.
            // The route handler does not forward a ctx so the second argument
            // is omitted (not explicitly passed as undefined).
            expect(mockGetAdminStats).toHaveBeenCalledOnce();
            const [calledWithActor] = mockGetAdminStats.mock.calls[0] ?? [];
            expect(calledWithActor).toEqual(specificActor);
        });

        it('handles an empty byRole map (no users)', async () => {
            // Arrange
            mockGetAdminStats.mockResolvedValue({
                data: { byRole: {}, newUsersTrend: [] },
                error: undefined
            });

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                byRole: Record<string, number>;
                newUsersTrend: unknown[];
            };

            // Assert
            expect(result.byRole).toEqual({});
            expect(result.newUsersTrend).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // Error path
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when service returns an error object', async () => {
            // Arrange
            mockGetAdminStats.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB exploded' }
            });

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('DB exploded');
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetAdminStats.mockRejectedValue(new Error('network timeout'));

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('network timeout');
        });
    });

    // -----------------------------------------------------------------------
    // Permission / auth
    // -----------------------------------------------------------------------

    describe('permission gating', () => {
        it('handler is registered on path /stats', () => {
            // Assert — ensures the route factory was called with the correct path
            expect(capturedHandlers.has('/stats')).toBe(true);
        });

        it('forwards actor to service (actor identity determines auth inside service)', async () => {
            // The route handler trusts the service to enforce USER_READ_ALL.
            // We verify the actor is passed through correctly.
            const actorWithoutPermissions: Actor = {
                id: 'restricted-user',
                role: RoleEnum.USER,
                permissions: []
            };
            mockGetActorFromContext.mockReturnValue(actorWithoutPermissions);
            // Simulate service throwing FORBIDDEN
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');
            mockGetAdminStats.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: USER_READ_ALL required'
                )
            );

            const handler = getStatsHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert — error propagates to the route factory error handler
            await expect(handler(ctx, {}, {})).rejects.toThrow(/USER_READ_ALL required/);
        });
    });
});
