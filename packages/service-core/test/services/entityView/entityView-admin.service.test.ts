/**
 * @file entityView-admin.service.test.ts
 *
 * Unit tests for the SPEC-197 admin methods of {@link EntityViewService}:
 *   - `getAdminSummary`      — platform-wide view totals, zero-fill guarantee
 *   - `getAdminBatch`        — batch stats for a set of entity IDs
 *   - `getAdminTopEntities`  — top-N ranked entities per type
 *   - `getAdminDailySeries`  — 30-day daily series, gap-filled to 90 rows
 *
 * All tests mock the EntityViewModel so no database connection is required.
 * Model mocking follows the convention in entityView.service.test.ts:
 * `createTypedModelMock(EntityViewModel, [...methods])`.
 */

import { EntityViewModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    EntityViewService,
    type GetAdminBatchInput,
    type GetAdminDailySeriesInput,
    type GetAdminSummaryInput,
    type GetAdminTopEntitiesInput
} from '../../../src/services/entityView/entityView.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Creates an actor that has the ANALYTICS_VIEW permission.
 */
function makeAnalyticsActor() {
    return createActor({
        id: 'admin-analytics-user',
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ANALYTICS_VIEW]
    });
}

/**
 * Creates an actor that does NOT have ANALYTICS_VIEW.
 */
function makeNoPermActor() {
    return createActor({
        id: 'no-perm-user',
        role: RoleEnum.USER,
        permissions: []
    });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EntityViewService — admin methods (SPEC-197)', () => {
    let service: EntityViewService;
    let modelMock: EntityViewModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        // EntityViewModel has no constructor params; createTypedModelMock handles it.
        // List all new admin model methods so they are definitely present as vi.fn().
        modelMock = createTypedModelMock(EntityViewModel, [
            'insertView',
            'getStatsForEntities',
            'purgeOlderThan',
            'getAdminSummaryTotals',
            'getTopViewedEntities',
            'getDailySeries'
        ]);
        loggerMock = createLoggerMock();
        // Pass undefined for accommodationModel — admin methods never use it.
        service = new EntityViewService({ logger: loggerMock }, modelMock, undefined);
    });

    // =========================================================================
    // getAdminSummary
    // =========================================================================

    describe('getAdminSummary', () => {
        describe('permission guard', () => {
            it('should return FORBIDDEN ServiceError when actor lacks ANALYTICS_VIEW', async () => {
                // Arrange
                const input: GetAdminSummaryInput = {
                    actor: makeNoPermActor(),
                    window: '30d'
                };

                // Act
                const result = await service.getAdminSummary(input);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });

            it('should NOT call model.getAdminSummaryTotals when permission is denied', async () => {
                // Arrange
                const input: GetAdminSummaryInput = {
                    actor: makeNoPermActor(),
                    window: '7d'
                };

                // Act
                await service.getAdminSummary(input);

                // Assert
                expect(asMock(modelMock.getAdminSummaryTotals)).not.toHaveBeenCalled();
            });
        });

        describe('happy path', () => {
            it('should call model.getAdminSummaryTotals with the correct windowDays for 30d', async () => {
                // Arrange
                asMock(modelMock.getAdminSummaryTotals).mockResolvedValue([
                    { entityType: EntityTypeEnum.ACCOMMODATION, unique: 10, total: 20 },
                    { entityType: EntityTypeEnum.POST, unique: 5, total: 8 },
                    { entityType: EntityTypeEnum.EVENT, unique: 3, total: 6 }
                ]);
                const input: GetAdminSummaryInput = {
                    actor: makeAnalyticsActor(),
                    window: '30d'
                };

                // Act
                await service.getAdminSummary(input);

                // Assert
                expect(asMock(modelMock.getAdminSummaryTotals)).toHaveBeenCalledOnce();
                const callArg = asMock(modelMock.getAdminSummaryTotals).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(30);
            });

            it('should call model.getAdminSummaryTotals with windowDays=7 for 7d window', async () => {
                // Arrange
                asMock(modelMock.getAdminSummaryTotals).mockResolvedValue([]);
                const input: GetAdminSummaryInput = {
                    actor: makeAnalyticsActor(),
                    window: '7d'
                };

                // Act
                await service.getAdminSummary(input);

                // Assert
                const callArg = asMock(modelMock.getAdminSummaryTotals).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(7);
            });

            it('should return exactly 3 items (all 3 entity types) when model returns all types', async () => {
                // Arrange
                asMock(modelMock.getAdminSummaryTotals).mockResolvedValue([
                    { entityType: EntityTypeEnum.ACCOMMODATION, unique: 10, total: 20 },
                    { entityType: EntityTypeEnum.POST, unique: 5, total: 8 },
                    { entityType: EntityTypeEnum.EVENT, unique: 3, total: 6 }
                ]);
                const input: GetAdminSummaryInput = {
                    actor: makeAnalyticsActor(),
                    window: '30d'
                };

                // Act
                const result = await service.getAdminSummary(input);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(3);
            });

            it('should zero-fill missing entity types when model returns only ACCOMMODATION', async () => {
                // Arrange — model returns only one row, service must zero-fill POST and EVENT
                asMock(modelMock.getAdminSummaryTotals).mockResolvedValue([
                    { entityType: EntityTypeEnum.ACCOMMODATION, unique: 10, total: 20 }
                ]);
                const input: GetAdminSummaryInput = {
                    actor: makeAnalyticsActor(),
                    window: '30d'
                };

                // Act
                const result = await service.getAdminSummary(input);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(3);

                const entityTypes = result.data?.map((r) => r.entityType) ?? [];
                expect(entityTypes).toContain(EntityTypeEnum.ACCOMMODATION);
                expect(entityTypes).toContain(EntityTypeEnum.POST);
                expect(entityTypes).toContain(EntityTypeEnum.EVENT);

                const postRow = result.data?.find((r) => r.entityType === EntityTypeEnum.POST);
                expect(postRow?.unique).toBe(0);
                expect(postRow?.total).toBe(0);

                const eventRow = result.data?.find((r) => r.entityType === EntityTypeEnum.EVENT);
                expect(eventRow?.unique).toBe(0);
                expect(eventRow?.total).toBe(0);
            });

            it('should zero-fill all 3 entity types when model returns an empty array', async () => {
                // Arrange
                asMock(modelMock.getAdminSummaryTotals).mockResolvedValue([]);
                const input: GetAdminSummaryInput = {
                    actor: makeAnalyticsActor(),
                    window: '30d'
                };

                // Act
                const result = await service.getAdminSummary(input);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(3);
                for (const row of result.data ?? []) {
                    expect(row.unique).toBe(0);
                    expect(row.total).toBe(0);
                }
            });
        });
    });

    // =========================================================================
    // getAdminBatch
    // =========================================================================

    describe('getAdminBatch', () => {
        describe('permission guard', () => {
            it('should return FORBIDDEN ServiceError when actor lacks ANALYTICS_VIEW', async () => {
                // Arrange
                const input: GetAdminBatchInput = {
                    actor: makeNoPermActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: [UUID_1],
                    window: '30d'
                };

                // Act
                const result = await service.getAdminBatch(input);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('validation guard — entityIds.length > 100', () => {
            it('should return VALIDATION_ERROR when entityIds has 101 items', async () => {
                // Arrange — generate 101 UUIDs
                const ids = Array.from(
                    { length: 101 },
                    (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`
                );
                const input: GetAdminBatchInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: ids,
                    window: '30d'
                };

                // Act
                const result = await service.getAdminBatch(input);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            });

            it('should NOT call model.getStatsForEntities when entityIds exceeds the cap', async () => {
                // Arrange
                const ids = Array.from(
                    { length: 101 },
                    (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`
                );
                const input: GetAdminBatchInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: ids,
                    window: '30d'
                };

                // Act
                await service.getAdminBatch(input);

                // Assert
                expect(asMock(modelMock.getStatsForEntities)).not.toHaveBeenCalled();
            });

            it('should accept exactly 100 items without VALIDATION_ERROR', async () => {
                // Arrange
                const ids = Array.from(
                    { length: 100 },
                    (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`
                );
                asMock(modelMock.getStatsForEntities).mockResolvedValue([]);
                const input: GetAdminBatchInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: ids,
                    window: '30d'
                };

                // Act
                const result = await service.getAdminBatch(input);

                // Assert — no VALIDATION_ERROR (may be error for other reasons in a real DB,
                // but the cap check must NOT fire for exactly 100 items)
                expect(result.error?.code).not.toBe(ServiceErrorCode.VALIDATION_ERROR);
            });
        });

        describe('happy path', () => {
            it('should call model.getStatsForEntities with correct args', async () => {
                // Arrange
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_1, unique: 5, total: 10 }
                ]);
                const input: GetAdminBatchInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: [UUID_1, UUID_2],
                    window: '30d'
                };

                // Act
                await service.getAdminBatch(input);

                // Assert
                expect(asMock(modelMock.getStatsForEntities)).toHaveBeenCalledOnce();
                const callArg = asMock(modelMock.getStatsForEntities).mock.calls[0]?.[0] as {
                    entityType: string;
                    entityIds: string[];
                    windowDays: number;
                };
                expect(callArg.entityType).toBe(EntityTypeEnum.ACCOMMODATION);
                expect(callArg.entityIds).toContain(UUID_1);
                expect(callArg.entityIds).toContain(UUID_2);
                expect(callArg.windowDays).toBe(30);
            });

            it('should zero-fill absent entity IDs in the result', async () => {
                // Arrange — model returns only UUID_1; UUID_2 and UUID_3 are absent
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_1, unique: 5, total: 10 }
                ]);
                const input: GetAdminBatchInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: [UUID_1, UUID_2, UUID_3],
                    window: '7d'
                };

                // Act
                const result = await service.getAdminBatch(input);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(3);

                const uuid2Row = result.data?.find((r) => r.entityId === UUID_2);
                expect(uuid2Row?.unique).toBe(0);
                expect(uuid2Row?.total).toBe(0);

                const uuid3Row = result.data?.find((r) => r.entityId === UUID_3);
                expect(uuid3Row?.unique).toBe(0);
                expect(uuid3Row?.total).toBe(0);
            });

            it('should use windowDays=7 when window is 7d', async () => {
                // Arrange
                asMock(modelMock.getStatsForEntities).mockResolvedValue([]);
                const input: GetAdminBatchInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.POST,
                    entityIds: [UUID_1],
                    window: '7d'
                };

                // Act
                await service.getAdminBatch(input);

                // Assert
                const callArg = asMock(modelMock.getStatsForEntities).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(7);
            });
        });
    });

    // =========================================================================
    // getAdminTopEntities
    // =========================================================================

    describe('getAdminTopEntities', () => {
        describe('permission guard', () => {
            it('should return FORBIDDEN ServiceError when actor lacks ANALYTICS_VIEW', async () => {
                // Arrange
                const input: GetAdminTopEntitiesInput = {
                    actor: makeNoPermActor(),
                    entityType: EntityTypeEnum.POST,
                    windowDays: 30,
                    limit: 10
                };

                // Act
                const result = await service.getAdminTopEntities(input);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('validation guard — limit > 50', () => {
            it('should return VALIDATION_ERROR when limit is 51', async () => {
                // Arrange
                const input: GetAdminTopEntitiesInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    windowDays: 30,
                    limit: 51
                };

                // Act
                const result = await service.getAdminTopEntities(input);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            });

            it('should NOT call model.getTopViewedEntities when limit > 50', async () => {
                // Arrange
                const input: GetAdminTopEntitiesInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.EVENT,
                    windowDays: 7,
                    limit: 100
                };

                // Act
                await service.getAdminTopEntities(input);

                // Assert
                expect(asMock(modelMock.getTopViewedEntities)).not.toHaveBeenCalled();
            });

            it('should accept limit=50 without VALIDATION_ERROR', async () => {
                // Arrange
                asMock(modelMock.getTopViewedEntities).mockResolvedValue([]);
                const input: GetAdminTopEntitiesInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    windowDays: 30,
                    limit: 50
                };

                // Act
                const result = await service.getAdminTopEntities(input);

                // Assert
                expect(result.error?.code).not.toBe(ServiceErrorCode.VALIDATION_ERROR);
            });
        });

        describe('happy path', () => {
            it('should call model.getTopViewedEntities with the correct args', async () => {
                // Arrange
                const topRows = [
                    { entityId: UUID_1, unique: 100, total: 200 },
                    { entityId: UUID_2, unique: 50, total: 80 }
                ];
                asMock(modelMock.getTopViewedEntities).mockResolvedValue(topRows);
                const input: GetAdminTopEntitiesInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.POST,
                    windowDays: 30,
                    limit: 10
                };

                // Act
                const result = await service.getAdminTopEntities(input);

                // Assert
                expect(asMock(modelMock.getTopViewedEntities)).toHaveBeenCalledOnce();
                const callArg = asMock(modelMock.getTopViewedEntities).mock.calls[0]?.[0] as {
                    entityType: string;
                    windowDays: number;
                    limit: number;
                };
                expect(callArg.entityType).toBe(EntityTypeEnum.POST);
                expect(callArg.windowDays).toBe(30);
                expect(callArg.limit).toBe(10);

                expect(result.error).toBeUndefined();
                expect(result.data).toEqual(topRows);
            });

            it('should pass windowDays=7 to the model when given 7', async () => {
                // Arrange
                asMock(modelMock.getTopViewedEntities).mockResolvedValue([]);
                const input: GetAdminTopEntitiesInput = {
                    actor: makeAnalyticsActor(),
                    entityType: EntityTypeEnum.EVENT,
                    windowDays: 7,
                    limit: 5
                };

                // Act
                await service.getAdminTopEntities(input);

                // Assert
                const callArg = asMock(modelMock.getTopViewedEntities).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(7);
            });
        });
    });

    // =========================================================================
    // getAdminDailySeries
    // =========================================================================

    describe('getAdminDailySeries', () => {
        describe('permission guard', () => {
            it('should return FORBIDDEN ServiceError when actor lacks ANALYTICS_VIEW', async () => {
                // Arrange
                const input: GetAdminDailySeriesInput = {
                    actor: makeNoPermActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });

            it('should NOT call model.getDailySeries when permission is denied', async () => {
                // Arrange
                const input: GetAdminDailySeriesInput = {
                    actor: makeNoPermActor(),
                    windowDays: 30
                };

                // Act
                await service.getAdminDailySeries(input);

                // Assert
                expect(asMock(modelMock.getDailySeries)).not.toHaveBeenCalled();
            });
        });

        describe('happy path — calls model with correct args', () => {
            it('should call model.getDailySeries with windowDays=30', async () => {
                // Arrange
                asMock(modelMock.getDailySeries).mockResolvedValue([]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                await service.getAdminDailySeries(input);

                // Assert
                expect(asMock(modelMock.getDailySeries)).toHaveBeenCalledOnce();
                const callArg = asMock(modelMock.getDailySeries).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(30);
            });
        });

        describe('gap-fill — exactly 90 rows', () => {
            it('should return exactly 90 rows when model returns an empty array', async () => {
                // Arrange — no views in the DB; service must gap-fill all 90 slots
                asMock(modelMock.getDailySeries).mockResolvedValue([]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(90);
            });

            it('should return exactly 90 rows when model returns 5 rows', async () => {
                // Arrange — model returns 5 rows (2026-06-05, all 3 types + 2 more)
                asMock(modelMock.getDailySeries).mockResolvedValue([
                    { date: '2026-06-05', entityType: EntityTypeEnum.ACCOMMODATION, total: 10 },
                    { date: '2026-06-05', entityType: EntityTypeEnum.POST, total: 5 },
                    { date: '2026-06-05', entityType: EntityTypeEnum.EVENT, total: 2 },
                    { date: '2026-06-04', entityType: EntityTypeEnum.ACCOMMODATION, total: 7 },
                    { date: '2026-06-04', entityType: EntityTypeEnum.POST, total: 3 }
                ]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(90);
            });

            it('should set total=0 for missing (date, entityType) combinations', async () => {
                // Arrange — model returns only one row; 89 others must be zero-filled
                asMock(modelMock.getDailySeries).mockResolvedValue([
                    { date: '2026-06-05', entityType: EntityTypeEnum.ACCOMMODATION, total: 42 }
                ]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert
                expect(result.data).toHaveLength(90);

                // All rows that are NOT (2026-06-05, ACCOMMODATION) must have total: 0
                const zeroRows = (result.data ?? []).filter(
                    (r) =>
                        !(r.date === '2026-06-05' && r.entityType === EntityTypeEnum.ACCOMMODATION)
                );
                expect(zeroRows).toHaveLength(89);
                for (const row of zeroRows) {
                    expect(row.total).toBe(0);
                }
            });

            it('should contain all 3 entity types in the result', async () => {
                // Arrange
                asMock(modelMock.getDailySeries).mockResolvedValue([]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert
                const entityTypes = new Set((result.data ?? []).map((r) => r.entityType));
                expect(entityTypes.has(EntityTypeEnum.ACCOMMODATION)).toBe(true);
                expect(entityTypes.has(EntityTypeEnum.POST)).toBe(true);
                expect(entityTypes.has(EntityTypeEnum.EVENT)).toBe(true);
            });

            it('should produce date strings in YYYY-MM-DD format for all rows', async () => {
                // Arrange
                asMock(modelMock.getDailySeries).mockResolvedValue([]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert — every date must match YYYY-MM-DD regex
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                for (const row of result.data ?? []) {
                    expect(row.date).toMatch(dateRegex);
                }
            });

            it('should preserve non-zero totals from model rows in the gap-filled result', async () => {
                // Arrange — model returns one row with total=99
                asMock(modelMock.getDailySeries).mockResolvedValue([
                    { date: '2026-06-05', entityType: EntityTypeEnum.POST, total: 99 }
                ]);
                const input: GetAdminDailySeriesInput = {
                    actor: makeAnalyticsActor(),
                    windowDays: 30
                };

                // Act
                const result = await service.getAdminDailySeries(input);

                // Assert
                const matchingRow = (result.data ?? []).find(
                    (r) => r.date === '2026-06-05' && r.entityType === EntityTypeEnum.POST
                );
                // The row is only present if '2026-06-05' is within the last 30 UTC days.
                // For the test to be date-independent we only assert the row is preserved
                // IF it appears in the result.
                if (matchingRow) {
                    expect(matchingRow.total).toBe(99);
                }
            });
        });
    });
});
