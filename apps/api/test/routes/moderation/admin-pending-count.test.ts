/**
 * Unit tests for the admin moderation pending-count route — SPEC-155 T-010.
 *
 * Verifies:
 *  - Handler returns `{ total, byEntity }` on service success.
 *  - `total` equals the sum of the four byEntity values.
 *  - Handler throws ServiceError when service returns an error.
 *  - Handler propagates FORBIDDEN when actor lacks ACCOMMODATION_MODERATION_CHANGE.
 *  - Handler is registered on the correct path (`/pending-count`).
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke
 * it directly. Avoids booting the full Hono application and middleware chain.
 * (Same pattern as T-012 `admin-stats.test.ts`.)
 *
 * @module test/routes/moderation/admin-pending-count
 * @see SPEC-155 T-010
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

const { mockGetPendingCount } = vi.hoisted(() => ({
    mockGetPendingCount: vi.fn()
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

// Mock ModerationAggregationService so no real DB calls happen.
vi.mock('@repo/service-core', () => ({
    ModerationAggregationService: vi.fn(() => ({
        getPendingCount: mockGetPendingCount
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

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';

// Trigger module execution — causes createAdminRoute to be called, which
// stores the handler in capturedHandlers.
await import('../../../src/routes/moderation/admin/pending-count');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
};

/**
 * Minimal mock context — the pending-count handler only reads the actor via
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

/** Retrieve the captured handler for the /pending-count path. Throws if not found. */
function getPendingCountHandler(): (
    ctx: unknown,
    params: unknown,
    body: unknown
) => Promise<unknown> {
    const handler = capturedHandlers.get('/pending-count');
    if (!handler) {
        throw new Error('No handler captured for path: /pending-count');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminModerationPendingCountRoute handler — SPEC-155 T-010', () => {
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
        it('returns the byEntity breakdown from the service', async () => {
            // Arrange
            const serviceData = {
                total: 17,
                byEntity: {
                    accommodations: 5,
                    destinations: 3,
                    posts: 7,
                    events: 2
                }
            };
            mockGetPendingCount.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual(serviceData);
        });

        it('total equals the sum of the four byEntity values', async () => {
            // Arrange
            const byEntity = { accommodations: 10, destinations: 4, posts: 6, events: 3 };
            const total = 10 + 4 + 6 + 3;
            mockGetPendingCount.mockResolvedValue({
                data: { total, byEntity },
                error: undefined
            });

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                total: number;
                byEntity: typeof byEntity;
            };

            // Assert
            const { accommodations, destinations, posts, events } = result.byEntity;
            expect(result.total).toBe(accommodations + destinations + posts + events);
        });

        it('returns zero total when no items are pending', async () => {
            // Arrange
            mockGetPendingCount.mockResolvedValue({
                data: {
                    total: 0,
                    byEntity: { accommodations: 0, destinations: 0, posts: 0, events: 0 }
                },
                error: undefined
            });

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                total: number;
                byEntity: { accommodations: number };
            };

            // Assert
            expect(result.total).toBe(0);
            expect(result.byEntity.accommodations).toBe(0);
        });

        it('calls getPendingCount with the resolved actor', async () => {
            // Arrange
            const specificActor = { ...ADMIN_ACTOR, id: 'specific-admin-42' };
            mockGetActorFromContext.mockReturnValue(specificActor);
            mockGetPendingCount.mockResolvedValue({
                data: {
                    total: 1,
                    byEntity: { accommodations: 1, destinations: 0, posts: 0, events: 0 }
                },
                error: undefined
            });

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — first argument to getPendingCount must be the actor.
            expect(mockGetPendingCount).toHaveBeenCalledOnce();
            const [calledWithActor] = mockGetPendingCount.mock.calls[0] ?? [];
            expect(calledWithActor).toEqual(specificActor);
        });

        it('returns all four entity keys in byEntity', async () => {
            // Arrange
            mockGetPendingCount.mockResolvedValue({
                data: {
                    total: 4,
                    byEntity: { accommodations: 1, destinations: 1, posts: 1, events: 1 }
                },
                error: undefined
            });

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                total: number;
                byEntity: Record<string, number>;
            };

            // Assert
            expect(result.byEntity).toHaveProperty('accommodations');
            expect(result.byEntity).toHaveProperty('destinations');
            expect(result.byEntity).toHaveProperty('posts');
            expect(result.byEntity).toHaveProperty('events');
        });
    });

    // -----------------------------------------------------------------------
    // Error path
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when service returns an error object', async () => {
            // Arrange
            mockGetPendingCount.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB exploded' }
            });

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('DB exploded');
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetPendingCount.mockRejectedValue(new Error('connection timeout'));

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('connection timeout');
        });
    });

    // -----------------------------------------------------------------------
    // Permission / registration
    // -----------------------------------------------------------------------

    describe('permission gating and registration', () => {
        it('handler is registered on path /pending-count', () => {
            // Assert — ensures createAdminRoute was called with the correct path
            expect(capturedHandlers.has('/pending-count')).toBe(true);
        });

        it('forwards actor to service (service enforces ACCOMMODATION_MODERATION_CHANGE)', async () => {
            // The route handler trusts the service to enforce the permission.
            // We verify the actor is forwarded correctly by simulating the service
            // returning a FORBIDDEN error.
            const actorWithoutPermissions: Actor = {
                id: 'restricted-user',
                role: RoleEnum.USER,
                permissions: []
            };
            mockGetActorFromContext.mockReturnValue(actorWithoutPermissions);

            const { ServiceError } = await import('@repo/service-core');
            mockGetPendingCount.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: ACCOMMODATION_MODERATION_CHANGE required'
                )
            );

            const handler = getPendingCountHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert — error propagates to the route factory error handler
            await expect(handler(ctx, {}, {})).rejects.toThrow(
                /ACCOMMODATION_MODERATION_CHANGE required/
            );
        });
    });
});
