/**
 * Unit tests for GET /api/v1/admin/views/* (SPEC-197 T-008–T-011).
 *
 * Covered routes:
 *   GET /summary      — Platform-wide totals per entity type (T-008)
 *   GET /batch        — Stats for a caller-supplied batch of entity IDs (T-009)
 *   GET /top          — Top-N most-viewed entities (T-010)
 *   GET /daily-series — 30-day daily series, gap-filled to 90 rows (T-011)
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler without mounting
 * the full Hono application, then invoke the handler directly.
 *
 * Coverage:
 *  - 403 without ANALYTICS_VIEW (service returns FORBIDDEN).
 *  - 200 happy path with correct response shape.
 *  - /batch: 101 ids → service returns VALIDATION_ERROR (propagated from handler).
 *  - /batch: single invalid UUID in list → Zod rejects before handler (tested via schema).
 *  - /top: limit=0 → Zod rejects (coerce.number().min(1)).
 *  - /top: limit=51 → Zod rejects (coerce.number().max(50)).
 *  - /daily-series: response always has 90 rows with valid YYYY-MM-DD dates.
 *
 * @module test/routes/views/admin/views-admin.routes.test
 * @see SPEC-197 T-008, T-009, T-010, T-011
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

const { mockGetAdminSummary, mockGetAdminBatch, mockGetAdminTopEntities, mockGetAdminDailySeries } =
    vi.hoisted(() => ({
        mockGetAdminSummary: vi.fn(),
        mockGetAdminBatch: vi.fn(),
        mockGetAdminTopEntities: vi.fn(),
        mockGetAdminDailySeries: vi.fn()
    }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createAdminRoute to capture raw handlers without booting Hono.
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
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
        getAdminSummary: mockGetAdminSummary,
        getAdminBatch: mockGetAdminBatch,
        getAdminTopEntities: mockGetAdminTopEntities,
        getAdminDailySeries: mockGetAdminDailySeries
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

import {
    AdminViewBatchQuerySchema,
    AdminViewTopQuerySchema,
    PermissionEnum,
    RoleEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module loading so createAdminRoute mock captures all four handlers.
await import('../../../../src/routes/views/admin/summary');
await import('../../../../src/routes/views/admin/batch');
await import('../../../../src/routes/views/admin/top');
await import('../../../../src/routes/views/admin/daily-series');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-uuid-001',
    role: RoleEnum.SUPER_ADMIN,
    permissions: [PermissionEnum.ANALYTICS_VIEW]
};

const ACCOMMODATION_IDS = [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
];

const SAMPLE_STATS = [
    { entityId: ACCOMMODATION_IDS[0], unique: 30, total: 80 },
    { entityId: ACCOMMODATION_IDS[1], unique: 10, total: 20 }
];

const SAMPLE_SUMMARY = [
    { entityType: 'ACCOMMODATION', unique: 120, total: 340 },
    { entityType: 'POST', unique: 55, total: 110 },
    { entityType: 'EVENT', unique: 30, total: 60 }
];

/** Builds a minimal mock Hono context object. */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieves the captured handler for a given path, throwing if not registered. */
function getHandler(
    path: string
): (ctx: unknown, params: unknown, body: unknown, query: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get(path);
    if (!handler) {
        throw new Error(`No handler captured for path: ${path}`);
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin views routes — SPEC-197 T-008–T-011', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // Route registration
    // =========================================================================

    describe('route registration', () => {
        it('registers handler for /summary', () => {
            expect(capturedHandlers.has('/summary')).toBe(true);
        });

        it('registers handler for /batch', () => {
            expect(capturedHandlers.has('/batch')).toBe(true);
        });

        it('registers handler for /top', () => {
            expect(capturedHandlers.has('/top')).toBe(true);
        });

        it('registers handler for /daily-series', () => {
            expect(capturedHandlers.has('/daily-series')).toBe(true);
        });
    });

    // =========================================================================
    // GET /summary
    // =========================================================================

    describe('GET /summary (T-008)', () => {
        describe('happy path', () => {
            it('returns AdminViewSummaryItem[] directly for default 30d window', async () => {
                // Arrange
                mockGetAdminSummary.mockResolvedValue({
                    data: SAMPLE_SUMMARY,
                    error: undefined
                });

                const handler = getHandler('/summary');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                const result = (await handler(
                    ctx,
                    {},
                    {},
                    { window: '30d' }
                )) as typeof SAMPLE_SUMMARY;

                // Assert — handler returns the bare array; createResponse wraps it once
                expect(result).toEqual(SAMPLE_SUMMARY);
                expect(result).toHaveLength(3);
            });

            it('calls getAdminSummary with 7d window', async () => {
                // Arrange
                mockGetAdminSummary.mockResolvedValue({
                    data: SAMPLE_SUMMARY,
                    error: undefined
                });

                const handler = getHandler('/summary');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                await handler(ctx, {}, {}, { window: '7d' });

                // Assert
                expect(mockGetAdminSummary).toHaveBeenCalledOnce();
                const [callArg] = mockGetAdminSummary.mock.calls[0] ?? [];
                expect(callArg).toMatchObject({ actor: ADMIN_ACTOR, window: '7d' });
            });
        });

        describe('error paths', () => {
            it('throws ServiceError when service returns FORBIDDEN', async () => {
                // Arrange
                mockGetAdminSummary.mockResolvedValue({
                    data: undefined,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Permission denied: ANALYTICS_VIEW required'
                    }
                });

                const handler = getHandler('/summary');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                    'Permission denied: ANALYTICS_VIEW required'
                );
            });

            it('throws ServiceError when service returns INTERNAL_ERROR', async () => {
                // Arrange
                mockGetAdminSummary.mockResolvedValue({
                    data: undefined,
                    error: { code: 'INTERNAL_ERROR', message: 'DB aggregation failed' }
                });

                const handler = getHandler('/summary');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(handler(ctx, {}, {}, { window: '30d' })).rejects.toThrow(
                    'DB aggregation failed'
                );
            });
        });
    });

    // =========================================================================
    // GET /batch
    // =========================================================================

    describe('GET /batch (T-009)', () => {
        describe('happy path', () => {
            it('returns EntityViewStats[] directly for valid batch', async () => {
                // Arrange
                mockGetAdminBatch.mockResolvedValue({
                    data: SAMPLE_STATS,
                    error: undefined
                });

                const handler = getHandler('/batch');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                const result = (await handler(
                    ctx,
                    {},
                    {},
                    {
                        entityType: 'ACCOMMODATION',
                        entityIds: ACCOMMODATION_IDS,
                        window: '30d'
                    }
                )) as typeof SAMPLE_STATS;

                // Assert — handler returns the bare array; createResponse wraps it once
                expect(result).toEqual(SAMPLE_STATS);
            });

            it('calls getAdminBatch with actor from context', async () => {
                // Arrange
                mockGetAdminBatch.mockResolvedValue({ data: SAMPLE_STATS, error: undefined });

                const handler = getHandler('/batch');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                await handler(
                    ctx,
                    {},
                    {},
                    {
                        entityType: 'ACCOMMODATION',
                        entityIds: ACCOMMODATION_IDS,
                        window: '30d'
                    }
                );

                // Assert
                const [callArg] = mockGetAdminBatch.mock.calls[0] ?? [];
                expect(callArg).toMatchObject({
                    actor: ADMIN_ACTOR,
                    entityType: 'ACCOMMODATION',
                    entityIds: ACCOMMODATION_IDS,
                    window: '30d'
                });
            });
        });

        describe('validation — AdminViewBatchQuerySchema', () => {
            it('rejects 101 IDs (tooMany)', () => {
                // Arrange — build a comma-separated string of 101 valid UUIDs
                const manyIds = Array.from(
                    { length: 101 },
                    (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
                ).join(',');

                // Act & Assert — schema-level rejection
                const result = AdminViewBatchQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    entityIds: manyIds,
                    window: '30d'
                });
                expect(result.success).toBe(false);
            });

            it('rejects a single invalid UUID in the list', () => {
                // Arrange — valid UUIDs + one invalid token
                const mixed = [...ACCOMMODATION_IDS, 'not-a-uuid'].join(',');

                // Act & Assert
                const result = AdminViewBatchQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    entityIds: mixed,
                    window: '30d'
                });
                expect(result.success).toBe(false);
            });

            it('accepts exactly 100 IDs (boundary)', () => {
                // Arrange
                const hundredIds = Array.from(
                    { length: 100 },
                    (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
                ).join(',');

                // Act & Assert
                const result = AdminViewBatchQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    entityIds: hundredIds,
                    window: '30d'
                });
                expect(result.success).toBe(true);
            });
        });

        describe('error paths', () => {
            it('throws ServiceError when service returns FORBIDDEN', async () => {
                // Arrange
                mockGetAdminBatch.mockResolvedValue({
                    data: undefined,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Permission denied: ANALYTICS_VIEW required'
                    }
                });

                const handler = getHandler('/batch');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(
                    handler(
                        ctx,
                        {},
                        {},
                        {
                            entityType: 'ACCOMMODATION',
                            entityIds: ACCOMMODATION_IDS,
                            window: '30d'
                        }
                    )
                ).rejects.toThrow('Permission denied: ANALYTICS_VIEW required');
            });

            it('throws ServiceError when service returns VALIDATION_ERROR (101 ids at service layer)', async () => {
                // Arrange — service returns VALIDATION_ERROR for 101 items (service-side cap check)
                mockGetAdminBatch.mockResolvedValue({
                    data: undefined,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'entityIds must contain at most 100 items'
                    }
                });

                const handler = getHandler('/batch');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(
                    handler(
                        ctx,
                        {},
                        {},
                        {
                            entityType: 'ACCOMMODATION',
                            entityIds: ACCOMMODATION_IDS,
                            window: '30d'
                        }
                    )
                ).rejects.toThrow('entityIds must contain at most 100 items');
            });
        });
    });

    // =========================================================================
    // GET /top
    // =========================================================================

    describe('GET /top (T-010)', () => {
        describe('happy path', () => {
            it('returns EntityViewStats[] directly, ordered by total DESC', async () => {
                // Arrange
                const topStats = [
                    { entityId: ACCOMMODATION_IDS[0], unique: 50, total: 200 },
                    { entityId: ACCOMMODATION_IDS[1], unique: 20, total: 80 }
                ];
                mockGetAdminTopEntities.mockResolvedValue({ data: topStats, error: undefined });

                const handler = getHandler('/top');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                const result = (await handler(
                    ctx,
                    {},
                    {},
                    {
                        entityType: 'ACCOMMODATION',
                        window: '30d',
                        limit: 10
                    }
                )) as typeof topStats;

                // Assert — handler returns the bare array; createResponse wraps it once
                expect(result).toEqual(topStats);
            });

            it('maps window "7d" to windowDays=7 when calling the service', async () => {
                // Arrange
                mockGetAdminTopEntities.mockResolvedValue({ data: [], error: undefined });

                const handler = getHandler('/top');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                await handler(
                    ctx,
                    {},
                    {},
                    {
                        entityType: 'POST',
                        window: '7d',
                        limit: 5
                    }
                );

                // Assert — service must receive windowDays=7, not the string '7d'
                const [callArg] = mockGetAdminTopEntities.mock.calls[0] ?? [];
                expect(callArg).toMatchObject({
                    actor: ADMIN_ACTOR,
                    entityType: 'POST',
                    windowDays: 7,
                    limit: 5
                });
            });

            it('maps window "30d" to windowDays=30', async () => {
                // Arrange
                mockGetAdminTopEntities.mockResolvedValue({ data: [], error: undefined });

                const handler = getHandler('/top');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                await handler(
                    ctx,
                    {},
                    {},
                    {
                        entityType: 'EVENT',
                        window: '30d',
                        limit: 10
                    }
                );

                // Assert
                const [callArg] = mockGetAdminTopEntities.mock.calls[0] ?? [];
                expect(callArg).toMatchObject({ windowDays: 30 });
            });
        });

        describe('validation — AdminViewTopQuerySchema', () => {
            it('rejects limit=0 (below min of 1)', () => {
                const result = AdminViewTopQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    window: '30d',
                    limit: '0'
                });
                expect(result.success).toBe(false);
            });

            it('rejects limit=51 (above max of 50)', () => {
                const result = AdminViewTopQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    window: '30d',
                    limit: '51'
                });
                expect(result.success).toBe(false);
            });

            it('accepts limit=1 (lower boundary)', () => {
                const result = AdminViewTopQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    window: '30d',
                    limit: '1'
                });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(1);
                }
            });

            it('accepts limit=50 (upper boundary)', () => {
                const result = AdminViewTopQuerySchema.safeParse({
                    entityType: 'ACCOMMODATION',
                    window: '30d',
                    limit: '50'
                });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(50);
                }
            });

            it('defaults limit to 10 when absent', () => {
                const result = AdminViewTopQuerySchema.safeParse({
                    entityType: 'POST',
                    window: '30d'
                });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.limit).toBe(10);
                }
            });
        });

        describe('error paths', () => {
            it('throws ServiceError when service returns FORBIDDEN', async () => {
                // Arrange
                mockGetAdminTopEntities.mockResolvedValue({
                    data: undefined,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Permission denied: ANALYTICS_VIEW required'
                    }
                });

                const handler = getHandler('/top');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(
                    handler(
                        ctx,
                        {},
                        {},
                        {
                            entityType: 'ACCOMMODATION',
                            window: '30d',
                            limit: 10
                        }
                    )
                ).rejects.toThrow('Permission denied: ANALYTICS_VIEW required');
            });
        });
    });

    // =========================================================================
    // GET /daily-series
    // =========================================================================

    describe('GET /daily-series (T-011)', () => {
        /** Generates 90 gap-filled rows (3 types × 30 days). */
        function buildDailySeriesRows(): Array<{
            date: string;
            entityType: string;
            total: number;
        }> {
            const types = ['ACCOMMODATION', 'POST', 'EVENT'] as const;
            const rows: Array<{ date: string; entityType: string; total: number }> = [];
            const today = new Date('2026-06-05');
            for (let day = 29; day >= 0; day--) {
                const d = new Date(today);
                d.setDate(today.getDate() - day);
                const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
                for (const type of types) {
                    rows.push({
                        date: dateStr,
                        entityType: type,
                        total: Math.floor(Math.random() * 50)
                    });
                }
            }
            return rows;
        }

        describe('happy path', () => {
            it('returns exactly 90 rows directly as array', async () => {
                // Arrange
                const rows = buildDailySeriesRows();
                mockGetAdminDailySeries.mockResolvedValue({ data: rows, error: undefined });

                const handler = getHandler('/daily-series');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                const result = (await handler(ctx, {}, {}, {})) as typeof rows;

                // Assert — handler returns the bare array; createResponse wraps it once
                expect(result).toHaveLength(90);
            });

            it('all dates are valid YYYY-MM-DD strings', async () => {
                // Arrange
                const rows = buildDailySeriesRows();
                mockGetAdminDailySeries.mockResolvedValue({ data: rows, error: undefined });

                const handler = getHandler('/daily-series');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                const result = (await handler(ctx, {}, {}, {})) as typeof rows;

                // Assert — every date must match ISO YYYY-MM-DD
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                for (const row of result) {
                    expect(row.date).toMatch(dateRegex);
                }
            });

            it('calls getAdminDailySeries with windowDays=30 (hardcoded)', async () => {
                // Arrange
                mockGetAdminDailySeries.mockResolvedValue({ data: [], error: undefined });

                const handler = getHandler('/daily-series');
                const ctx = buildMockContext() as unknown as Context;

                // Act
                await handler(ctx, {}, {}, {});

                // Assert — V1 always uses 30
                const [callArg] = mockGetAdminDailySeries.mock.calls[0] ?? [];
                expect(callArg).toMatchObject({ actor: ADMIN_ACTOR, windowDays: 30 });
            });
        });

        describe('error paths', () => {
            it('throws ServiceError when service returns FORBIDDEN', async () => {
                // Arrange
                mockGetAdminDailySeries.mockResolvedValue({
                    data: undefined,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Permission denied: ANALYTICS_VIEW required'
                    }
                });

                const handler = getHandler('/daily-series');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(handler(ctx, {}, {}, {})).rejects.toThrow(
                    'Permission denied: ANALYTICS_VIEW required'
                );
            });

            it('throws ServiceError when service returns INTERNAL_ERROR', async () => {
                // Arrange
                mockGetAdminDailySeries.mockResolvedValue({
                    data: undefined,
                    error: { code: 'INTERNAL_ERROR', message: 'DB query failed' }
                });

                const handler = getHandler('/daily-series');
                const ctx = buildMockContext() as unknown as Context;

                // Act & Assert
                await expect(handler(ctx, {}, {}, {})).rejects.toThrow('DB query failed');
            });
        });
    });
});
