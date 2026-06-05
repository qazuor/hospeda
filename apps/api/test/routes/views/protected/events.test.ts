/**
 * Unit tests for GET /api/v1/protected/views/events (SPEC-159 T-010).
 *
 * Verifies:
 *  - Happy path: returns `{ data: EntityViewStats[] }` when service succeeds.
 *  - Service is called with `entityType: EntityTypeEnum.EVENT` and the context actor.
 *  - The actor is always taken from context — no caller-supplied owner ID accepted.
 *  - Service FORBIDDEN error → handler throws ServiceError.
 *  - Service INTERNAL_ERROR → handler throws ServiceError.
 *  - Route is registered at path `/events`.
 *
 * Query-param validation (missing entityIds, >100 ids, malformed UUIDs,
 * invalid window) is enforced by the route factory's Zod query schema — those
 * paths produce 400 at the framework layer before the handler is reached. The
 * handler tests below focus on handler-level logic: actor scoping, entityType
 * forwarding, and error propagation.
 *
 * @module test/routes/views/protected/events
 * @see SPEC-159 T-010
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query: unknown) => Promise<unknown>
    >()
}));

const { mockGetStatsForEditorEntities } = vi.hoisted(() => ({
    mockGetStatsForEditorEntities: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    entityViewService: {
        getStatsForEditorEntities: mockGetStatsForEditorEntities
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

import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

await import('../../../../src/routes/views/protected/events');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const EDITOR_ACTOR: Actor = {
    id: 'editor-uuid-003',
    role: RoleEnum.EDITOR,
    permissions: [PermissionEnum.EVENT_VIEW_ALL]
};

const SAMPLE_EVENT_IDS = [
    '660e8400-e29b-41d4-a716-446655440020',
    '660e8400-e29b-41d4-a716-446655440021'
];

const SAMPLE_STATS = [
    { entityId: SAMPLE_EVENT_IDS[0], unique: 15, total: 38 },
    { entityId: SAMPLE_EVENT_IDS[1], unique: 0, total: 0 }
];

function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

function getHandler(): (
    ctx: unknown,
    params: unknown,
    body: unknown,
    query: unknown
) => Promise<unknown> {
    const handler = capturedHandlers.get('/events');
    if (!handler) {
        throw new Error('No handler captured for path: /events');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('eventViewStatsRoute handler — SPEC-159 T-010', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(EDITOR_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('route registration', () => {
        it('handler is registered on path /events', () => {
            expect(capturedHandlers.has('/events')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns { data: EntityViewStats[] } for valid entityIds and 30d window', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockResolvedValue({
                data: SAMPLE_STATS,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(
                ctx,
                {},
                {},
                {
                    window: '30d',
                    entityIds: SAMPLE_EVENT_IDS
                }
            )) as { data: typeof SAMPLE_STATS };

            // Assert
            expect(result.data).toEqual(SAMPLE_STATS);
        });

        it('returns stats for the 7d window', async () => {
            // Arrange
            const shortWindowStats = [{ entityId: SAMPLE_EVENT_IDS[0], unique: 2, total: 5 }];
            mockGetStatsForEditorEntities.mockResolvedValue({
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
                {
                    window: '7d',
                    entityIds: SAMPLE_EVENT_IDS
                }
            )) as { data: typeof shortWindowStats };

            // Assert
            expect(result.data).toEqual(shortWindowStats);
        });

        it('zero-view entries returned for IDs absent from the DB window', async () => {
            // Arrange
            const zeroedStats = [
                { entityId: SAMPLE_EVENT_IDS[0], unique: 0, total: 0 },
                { entityId: SAMPLE_EVENT_IDS[1], unique: 0, total: 0 }
            ];
            mockGetStatsForEditorEntities.mockResolvedValue({
                data: zeroedStats,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(
                ctx,
                {},
                {},
                {
                    window: '30d',
                    entityIds: SAMPLE_EVENT_IDS
                }
            )) as { data: typeof zeroedStats };

            // Assert
            expect(result.data.every((s) => s.unique === 0 && s.total === 0)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Scope isolation — actor from context; entityType must be EVENT
    // -----------------------------------------------------------------------

    describe('scope isolation', () => {
        it('calls getStatsForEditorEntities with entityType EVENT and context actor', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockResolvedValue({
                data: SAMPLE_STATS,
                error: undefined
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {}, { window: '30d', entityIds: SAMPLE_EVENT_IDS });

            // Assert — entityType must always be EVENT; actor is from context
            expect(mockGetStatsForEditorEntities).toHaveBeenCalledOnce();
            const [callArg] = mockGetStatsForEditorEntities.mock.calls[0] ?? [];
            expect(callArg).toMatchObject({
                actor: EDITOR_ACTOR,
                entityType: EntityTypeEnum.EVENT,
                entityIds: SAMPLE_EVENT_IDS,
                window: '30d'
            });
        });

        it('does NOT include a caller-supplied ownerId in the service call', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockResolvedValue({ data: [], error: undefined });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(
                ctx,
                {},
                {},
                {
                    window: '30d',
                    entityIds: SAMPLE_EVENT_IDS
                }
            );

            // Assert
            const [callArg] = mockGetStatsForEditorEntities.mock.calls[0] ?? [];
            expect(callArg).not.toHaveProperty('ownerId');
        });

        it('events route does NOT forward POST entityType to the service', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockResolvedValue({ data: [], error: undefined });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {}, { window: '30d', entityIds: SAMPLE_EVENT_IDS });

            // Assert — entityType must be EVENT, never POST
            const [callArg] = mockGetStatsForEditorEntities.mock.calls[0] ?? [];
            expect(callArg.entityType).toBe(EntityTypeEnum.EVENT);
            expect(callArg.entityType).not.toBe(EntityTypeEnum.POST);
        });
    });

    // -----------------------------------------------------------------------
    // Error paths
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when the service returns FORBIDDEN', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockResolvedValue({
                data: undefined,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Permission denied: EVENT_VIEW_ALL required'
                }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(
                handler(ctx, {}, {}, { window: '30d', entityIds: SAMPLE_EVENT_IDS })
            ).rejects.toThrow('Permission denied: EVENT_VIEW_ALL required');
        });

        it('throws ServiceError when the service returns INTERNAL_ERROR', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB aggregation failed' }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(
                handler(ctx, {}, {}, { window: '30d', entityIds: SAMPLE_EVENT_IDS })
            ).rejects.toThrow('DB aggregation failed');
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetStatsForEditorEntities.mockRejectedValue(new Error('network timeout'));

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(
                handler(ctx, {}, {}, { window: '30d', entityIds: SAMPLE_EVENT_IDS })
            ).rejects.toThrow('network timeout');
        });
    });
});
