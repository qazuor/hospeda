/**
 * Unit tests for the host conversation response-rate route — SPEC-155 T-006.
 *
 * Verifies:
 *  - Handler returns `{ responseRatePct, avgResponseTimeMinutes }` on success.
 *  - Handler throws ServiceError when the service returns an error.
 *  - FORBIDDEN is propagated when the actor lacks CONVERSATION_VIEW_OWN.
 *  - The ownerId is always taken from `actor.id` (scope isolation — callers
 *    cannot override the owner via a query param).
 *  - Route is registered at path `/me/response-rate`.
 *
 * Pattern: mock `createProtectedRoute` to capture the raw handler, then
 * invoke it directly.  Avoids booting the full Hono application.
 *
 * @module test/routes/conversations/protected/response-rate
 * @see SPEC-155 T-006
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

const { mockGetHostResponseRate } = vi.hoisted(() => ({
    mockGetHostResponseRate: vi.fn()
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

// Mock actor extraction so tests control who is performing the request.
vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Mock ConversationService so no real DB calls happen.
// RoleEnum must be included so entitlement.ts can build STAFF_BILLING_BYPASS_ROLES
// at module-load time (SPEC-145 T-026).
vi.mock('@repo/service-core', () => ({
    ConversationService: vi.fn(() => ({
        getHostResponseRate: mockGetHostResponseRate
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

// Mock env so the ConversationService constructor does not need real vars.
vi.mock('../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_BETTER_AUTH_SECRET: 'test-secret',
        HOSPEDA_SITE_URL: 'http://localhost:4321'
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

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution — causes createProtectedRoute to be called, which
// stores the handler in capturedHandlers.
await import('../../../../src/routes/conversations/protected/response-rate');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const HOST_ACTOR: Actor = {
    id: 'host-actor-uuid-1',
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.CONVERSATION_VIEW_OWN, PermissionEnum.CONVERSATION_REPLY_OWN]
};

const ANOTHER_HOST_ACTOR: Actor = {
    id: 'host-actor-uuid-2',
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.CONVERSATION_VIEW_OWN, PermissionEnum.CONVERSATION_REPLY_OWN]
};

/**
 * Minimal mock context — the handler only reads the actor via
 * getActorFromContext; c.json() is handled by the route factory wrapper.
 */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for `/me/response-rate`. Throws if missing. */
function getHandler(): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get('/me/response-rate');
    if (!handler) {
        throw new Error('No handler captured for path: /me/response-rate');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hostConversationResponseRateRoute handler — SPEC-155 T-006', () => {
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
        it('handler is registered on path /me/response-rate', () => {
            expect(capturedHandlers.has('/me/response-rate')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns responseRatePct and avgResponseTimeMinutes from the service', async () => {
            // Arrange
            const serviceData = {
                responseRatePct: 83.3,
                avgResponseTimeMinutes: 47
            };
            mockGetHostResponseRate.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual(serviceData);
            expect((result as typeof serviceData).responseRatePct).toBe(83.3);
            expect((result as typeof serviceData).avgResponseTimeMinutes).toBe(47);
        });

        it('returns null avgResponseTimeMinutes when host has no replied conversations', async () => {
            // Arrange
            mockGetHostResponseRate.mockResolvedValue({
                data: { responseRatePct: 0, avgResponseTimeMinutes: null },
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                responseRatePct: number;
                avgResponseTimeMinutes: number | null;
            };

            // Assert
            expect(result.responseRatePct).toBe(0);
            expect(result.avgResponseTimeMinutes).toBeNull();
        });

        it('returns zeroed values when host has no conversations at all', async () => {
            // Arrange
            mockGetHostResponseRate.mockResolvedValue({
                data: { responseRatePct: 0, avgResponseTimeMinutes: null },
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as {
                responseRatePct: number;
                avgResponseTimeMinutes: number | null;
            };

            // Assert — empty inbox should not crash
            expect(result.responseRatePct).toBe(0);
            expect(result.avgResponseTimeMinutes).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Scope isolation — ownerId is always actor.id
    // -----------------------------------------------------------------------

    describe('scope isolation', () => {
        it('calls getHostResponseRate with HOST_ACTOR (not ANOTHER_HOST_ACTOR)', async () => {
            // Arrange — actor is HOST_ACTOR (uuid-1)
            mockGetActorFromContext.mockReturnValue(HOST_ACTOR);
            mockGetHostResponseRate.mockResolvedValue({
                data: { responseRatePct: 75, avgResponseTimeMinutes: 30 },
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — first arg to getHostResponseRate must be the actor
            expect(mockGetHostResponseRate).toHaveBeenCalledOnce();
            const [calledWithActor] = mockGetHostResponseRate.mock.calls[0] ?? [];
            expect(calledWithActor).toEqual(HOST_ACTOR);
            expect(calledWithActor).not.toEqual(ANOTHER_HOST_ACTOR);
        });

        it('does NOT pass ownerId from query params — actor.id is the only scope', async () => {
            // The route signature has no requestQuery at all; this test verifies the
            // service is called only with the actor (no extra ownerId param).
            mockGetActorFromContext.mockReturnValue(ANOTHER_HOST_ACTOR);
            mockGetHostResponseRate.mockResolvedValue({
                data: { responseRatePct: 50, avgResponseTimeMinutes: null },
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — service receives the actor, nothing else
            expect(mockGetHostResponseRate).toHaveBeenCalledWith(ANOTHER_HOST_ACTOR);
        });
    });

    // -----------------------------------------------------------------------
    // Error path
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when service returns an error object', async () => {
            // Arrange
            mockGetHostResponseRate.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB exploded' }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('DB exploded');
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetHostResponseRate.mockRejectedValue(new Error('network timeout'));

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('network timeout');
        });
    });

    // -----------------------------------------------------------------------
    // Permission / auth
    // -----------------------------------------------------------------------

    describe('permission gating', () => {
        it('propagates FORBIDDEN when actor lacks CONVERSATION_VIEW_OWN', async () => {
            // The route relies on createProtectedRoute + the service to enforce
            // CONVERSATION_VIEW_OWN. We verify the error propagates correctly.
            const actorWithoutPermission: Actor = {
                id: 'no-perm-user',
                role: RoleEnum.USER,
                permissions: []
            };
            mockGetActorFromContext.mockReturnValue(actorWithoutPermission);

            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');
            mockGetHostResponseRate.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: CONVERSATION_VIEW_OWN required for host response rate'
                )
            );

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow(/CONVERSATION_VIEW_OWN required/);
        });
    });
});
