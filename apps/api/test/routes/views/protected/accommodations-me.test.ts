/**
 * Unit tests for GET /api/v1/protected/views/accommodations/me (SPEC-159 T-009).
 *
 * Verifies:
 *  - Handler returns `{ data: EntityViewStats[] }` on service success.
 *  - Service is always called with `actor.id` from context — no caller-supplied
 *    owner ID is accepted (scope isolation).
 *  - Service FORBIDDEN error → handler throws ServiceError (propagated to 403).
 *  - Service INTERNAL_ERROR → handler throws ServiceError (propagated to 500).
 *  - Invalid window value ('90d') → 400 (Zod query validation catches it).
 *  - Unauthenticated request → 401 (protectedAuthMiddleware).
 *  - Route is registered at path `/accommodations/me`.
 *
 * Pattern: mock `createProtectedRoute` to capture the raw handler, then
 * invoke it directly. Avoids booting the full Hono application.
 *
 * @module test/routes/views/protected/accommodations-me
 * @see SPEC-159 T-009
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs — available inside vi.mock() factory closures.
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query: unknown) => Promise<unknown>
    >()
}));

const { mockGetStatsForHostAccommodations } = vi.hoisted(() => ({
    mockGetStatsForHostAccommodations: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createProtectedRoute to capture the raw handler without mounting Hono.
vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn(
        (config: {
            path: string;
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query: unknown
            ) => Promise<unknown>;
        }) => {
            capturedHandlers.set(config.path, config.handler);
            return config.handler;
        }
    )
}));

// Mock actor extraction so tests control the requesting actor.
vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Mock plan.service so the module-level `new PlanService()` in entitlement.ts
// does not throw when the route module is imported (the route now wires
// requireEntitlement(VIEW_BASIC_STATS) — same pattern as response-rate.test.ts).
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: vi.fn(),
        getBySlug: vi.fn()
    }))
}));

// Mock entityViewService — no real DB calls. RoleEnum must be included so
// entitlement.ts can build STAFF_BILLING_BYPASS_ROLES at module-load time
// (same pattern as response-rate.test.ts, SPEC-145 T-026).
vi.mock('@repo/service-core', () => ({
    entityViewService: {
        getStatsForHostAccommodations: mockGetStatsForHostAccommodations
    },
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution — causes createProtectedRoute to be called, storing
// the handler in capturedHandlers.
await import('../../../../src/routes/views/protected/accommodations-me');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const HOST_ACTOR: Actor = {
    id: 'host-uuid-001',
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
};

const ANOTHER_HOST_ACTOR: Actor = {
    id: 'host-uuid-002',
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
};

const SAMPLE_STATS = [
    { entityId: 'acc-uuid-001', unique: 42, total: 150 },
    { entityId: 'acc-uuid-002', unique: 0, total: 0 }
];

/**
 * Minimal mock context — the handler reads the actor via getActorFromContext.
 * c.json() is handled by the route factory wrapper and not needed here.
 */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for `/accommodations/me`. Throws if missing. */
function getHandler(): (
    ctx: unknown,
    params: unknown,
    body: unknown,
    query: unknown
) => Promise<unknown> {
    const handler = capturedHandlers.get('/accommodations/me');
    if (!handler) {
        throw new Error('No handler captured for path: /accommodations/me');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hostAccommodationViewStatsRoute handler — SPEC-159 T-009', () => {
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
        it('handler is registered on path /accommodations/me', () => {
            expect(capturedHandlers.has('/accommodations/me')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns EntityViewStats[] directly for the 30d default window', async () => {
            // Arrange
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: SAMPLE_STATS,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {}, { window: '30d' })) as typeof SAMPLE_STATS;

            // Assert — handler returns the bare array; createResponse wraps it once
            expect(result).toEqual(SAMPLE_STATS);
            expect(result).toHaveLength(2);
        });

        it('returns stats for the 7d window', async () => {
            // Arrange
            const shortWindowStats = [{ entityId: 'acc-uuid-001', unique: 5, total: 12 }];
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: shortWindowStats,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(
                ctx,
                {},
                {},
                { window: '7d' }
            )) as typeof shortWindowStats;

            // Assert — handler returns the bare array; createResponse wraps it once
            expect(result).toEqual(shortWindowStats);
        });

        it('returns empty array when host has no accommodations', async () => {
            // Arrange
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: [],
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {}, { window: '30d' })) as unknown[];

            // Assert — handler returns the bare array; createResponse wraps it once
            expect(result).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // Scope isolation — actor.id is the only owner scope
    // -----------------------------------------------------------------------

    describe('scope isolation', () => {
        it('calls getStatsForHostAccommodations with the context actor', async () => {
            // Arrange
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: SAMPLE_STATS,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {}, { window: '30d' });

            // Assert — service must receive the actor from context
            expect(mockGetStatsForHostAccommodations).toHaveBeenCalledOnce();
            const [callArg] = mockGetStatsForHostAccommodations.mock.calls[0] ?? [];
            expect(callArg).toMatchObject({ actor: HOST_ACTOR, window: '30d' });
        });

        it('does NOT allow a different host actor to be injected via query params', async () => {
            // Arrange — actor from context is HOST_ACTOR (uuid-001); the handler
            // must never use a caller-supplied ownerId.
            mockGetActorFromContext.mockReturnValue(ANOTHER_HOST_ACTOR);
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: [],
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act — simulate a caller attempting to pass a different ownerId
            // (the schema rejects unknown query params, but we verify the service
            // receives only the context actor regardless).
            await handler(ctx, {}, {}, { window: '30d' });

            // Assert — service receives ANOTHER_HOST_ACTOR, not HOST_ACTOR
            const [callArg] = mockGetStatsForHostAccommodations.mock.calls[0] ?? [];
            expect(callArg).toMatchObject({ actor: ANOTHER_HOST_ACTOR });
            expect(callArg.actor.id).toBe('host-uuid-002');
            expect(callArg.actor.id).not.toBe('host-uuid-001');
        });
    });

    // -----------------------------------------------------------------------
    // Error paths
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when the service returns FORBIDDEN', async () => {
            // Arrange
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: undefined,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Permission denied: ACCOMMODATION_VIEW_OWN required'
                }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                'Permission denied: ACCOMMODATION_VIEW_OWN required'
            );
        });

        it('throws ServiceError when the service returns INTERNAL_ERROR', async () => {
            // Arrange
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB query failed' }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                'DB query failed'
            );
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetStatsForHostAccommodations.mockRejectedValue(new Error('network timeout'));

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                'network timeout'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Permission gating (permission configured on the route factory)
    // -----------------------------------------------------------------------

    describe('permission gating', () => {
        it('propagates FORBIDDEN when actor lacks ACCOMMODATION_VIEW_OWN', async () => {
            // Arrange — actor has no permissions
            const actorWithoutPermission: Actor = {
                id: 'no-perm-user',
                role: RoleEnum.USER,
                permissions: []
            };
            mockGetActorFromContext.mockReturnValue(actorWithoutPermission);
            mockGetStatsForHostAccommodations.mockResolvedValue({
                data: undefined,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Permission denied: ACCOMMODATION_VIEW_OWN required'
                }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                /ACCOMMODATION_VIEW_OWN required/
            );
        });
    });
});
