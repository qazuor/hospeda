/**
 * Unit tests for GET /api/v1/protected/views/accommodations/me/daily-series (SPEC-207 §4.1).
 *
 * Verifies:
 *  - Handler returns `{ window, items }` on service success.
 *  - Service is always called with `actor.id` from context — no caller-supplied
 *    owner ID is accepted (scope isolation).
 *  - Service FORBIDDEN error → handler throws ServiceError (propagated to 403).
 *  - Service INTERNAL_ERROR → handler throws ServiceError (propagated to 500).
 *  - Route is registered at path `/accommodations/me/daily-series`.
 *  - Response object includes the echoed `window` field.
 *
 * Pattern: mock `createProtectedRoute` to capture the raw handler, then
 * invoke it directly. Avoids booting the full Hono application.
 *
 * @module test/routes/views/protected/daily-series
 * @see SPEC-207 §4.1
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

const { mockGetDailySeriesForHostAccommodations } = vi.hoisted(() => ({
    mockGetDailySeriesForHostAccommodations: vi.fn()
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

// Mock PlanService to avoid module-load-time DB access from entitlement middleware.
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: vi.fn(),
        getBySlug: vi.fn()
    }))
}));

// Mock entityViewService — no real DB calls.
vi.mock('@repo/service-core', () => ({
    entityViewService: {
        getDailySeriesForHostAccommodations: mockGetDailySeriesForHostAccommodations
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
await import('../../../../src/routes/views/protected/daily-series');

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

const SAMPLE_ITEMS = [
    { date: '2026-05-17', total: 5 },
    { date: '2026-05-18', total: 0 },
    { date: '2026-05-19', total: 12 }
];

/** Minimal mock context — the handler reads the actor via getActorFromContext. */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for `/accommodations/me/daily-series`. Throws if missing. */
function getHandler(): (
    ctx: unknown,
    params: unknown,
    body: unknown,
    query: unknown
) => Promise<unknown> {
    const handler = capturedHandlers.get('/accommodations/me/daily-series');
    if (!handler) {
        throw new Error('No handler captured for path: /accommodations/me/daily-series');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hostAccommodationDailySeriesRoute handler — SPEC-207', () => {
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
        it('handler is registered on path /accommodations/me/daily-series', () => {
            expect(capturedHandlers.has('/accommodations/me/daily-series')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns { window, items } for the 30d default window', async () => {
            // Arrange
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
                data: SAMPLE_ITEMS,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {}, { window: '30d' })) as {
                window: string;
                items: typeof SAMPLE_ITEMS;
            };

            // Assert
            expect(result.window).toBe('30d');
            expect(result.items).toEqual(SAMPLE_ITEMS);
        });

        it('returns { window: "7d", items } for the 7d window', async () => {
            // Arrange
            const shortWindowItems = [
                { date: '2026-06-09', total: 2 },
                { date: '2026-06-10', total: 0 }
            ];
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
                data: shortWindowItems,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {}, { window: '7d' })) as {
                window: string;
                items: typeof shortWindowItems;
            };

            // Assert
            expect(result.window).toBe('7d');
            expect(result.items).toEqual(shortWindowItems);
        });

        it('returns all-zero items when host owns no accommodations', async () => {
            // Arrange
            const zeroItems = Array.from({ length: 30 }, (_, i) => ({
                date: `2026-05-${String(i + 1).padStart(2, '0')}`,
                total: 0
            }));
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
                data: zeroItems,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {}, { window: '30d' })) as {
                window: string;
                items: { date: string; total: number }[];
            };

            // Assert
            expect(result.items.every((item) => item.total === 0)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Scope isolation — actor.id is the only owner scope
    // -----------------------------------------------------------------------

    describe('scope isolation', () => {
        it('calls getDailySeriesForHostAccommodations with the context actor', async () => {
            // Arrange
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
                data: SAMPLE_ITEMS,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {}, { window: '30d' });

            // Assert — service must receive the actor from context
            expect(mockGetDailySeriesForHostAccommodations).toHaveBeenCalledOnce();
            const [callArg] = mockGetDailySeriesForHostAccommodations.mock.calls[0] ?? [];
            expect(callArg).toMatchObject({ actor: HOST_ACTOR, window: '30d' });
        });

        it('uses ANOTHER_HOST_ACTOR when a different actor is in context', async () => {
            // Arrange — actor from context is ANOTHER_HOST_ACTOR
            mockGetActorFromContext.mockReturnValue(ANOTHER_HOST_ACTOR);
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
                data: [],
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {}, { window: '30d' });

            // Assert — service receives ANOTHER_HOST_ACTOR, not HOST_ACTOR
            const [callArg] = mockGetDailySeriesForHostAccommodations.mock.calls[0] ?? [];
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
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
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
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
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
            mockGetDailySeriesForHostAccommodations.mockRejectedValue(new Error('network timeout'));

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                'network timeout'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Permission gating
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
            mockGetDailySeriesForHostAccommodations.mockResolvedValue({
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
