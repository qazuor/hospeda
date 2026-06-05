/**
 * @file entity-view-admin.model.test.ts
 *
 * Unit tests for the three admin-facing methods added to EntityViewModel
 * by SPEC-197 (T-004 + T-005 + T-006):
 *   - getTopViewedEntities (§4.1 method A)
 *   - getDailySeries       (§4.1 method B)
 *   - getAdminSummaryTotals (§4.1 method C)
 *
 * **Test strategy**: mirrors entity-view.model.test.ts — uses
 * `vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient')`
 * to inject a mock db whose `execute` method returns controlled fixtures.
 * No live PostgreSQL instance is required. Tests focus on result shape,
 * numeric coercion, ordering, and the gap-fill semantics contract (model
 * does NOT gap-fill; that is a service concern).
 *
 * SQL semantic edge cases (dedup window correctness) are validated by the
 * real-DB smoke task T-016-smoke.
 */

import type { TrackableEntityType } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EntityViewModel,
    type GetAdminSummaryTotalsInput,
    type GetDailySeriesInput,
    type GetTopViewedEntitiesInput
} from '../../../src/models/entity-view/entity-view.model.ts';

// Mock the logger so tests don't produce noise.
vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const UUID_A = '550e8400-e29b-41d4-a716-446655440001';
const UUID_B = '550e8400-e29b-41d4-a716-446655440002';
const UUID_C = '550e8400-e29b-41d4-a716-446655440003';

/** Typed constants to avoid TS enum assignment errors. */
const ACCOMMODATION = 'ACCOMMODATION' as TrackableEntityType;
const POST = 'POST' as TrackableEntityType;
const EVENT = 'EVENT' as TrackableEntityType;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MockDb = { execute: ReturnType<typeof vi.fn> };

/**
 * Builds a minimal mock db object whose `execute` method returns a controlled
 * result. The result is a plain array (Drizzle postgres-js driver style);
 * tests for the node-postgres `{ rows }` shape use a separate helper below.
 */
function buildMockDb(executeResult: unknown[]): MockDb {
    return { execute: vi.fn().mockResolvedValue(executeResult) };
}

/**
 * Builds a mock db that returns the node-postgres `{ rows: [...] }` shape.
 */
function buildMockDbPgShape(rows: unknown[]): MockDb {
    return { execute: vi.fn().mockResolvedValue({ rows }) };
}

/** Spy `getClient` on the model to return the given mock db. */
function injectDb(model: EntityViewModel, mockDb: MockDb): void {
    vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(mockDb);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('EntityViewModel — admin methods (SPEC-197)', () => {
    let model: EntityViewModel;

    beforeEach(() => {
        model = new EntityViewModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // getTopViewedEntities
    // =========================================================================

    describe('getTopViewedEntities', () => {
        const baseInput: GetTopViewedEntitiesInput = {
            entityType: ACCOMMODATION,
            windowDays: 30,
            limit: 10
        };

        describe('when the database returns multiple rows', () => {
            it('should map raw rows to EntityViewStats shape with numeric coercion', async () => {
                // Arrange — pg driver returns aggregates as strings
                const rawRows = [
                    { entityId: UUID_A, unique: '10', total: '30' },
                    { entityId: UUID_B, unique: '5', total: '12' },
                    { entityId: UUID_C, unique: '2', total: '5' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getTopViewedEntities(baseInput);

                // Assert — shape and coercion
                expect(result).toHaveLength(3);
                expect(result[0]).toEqual({ entityId: UUID_A, unique: 10, total: 30 });
                expect(result[1]).toEqual({ entityId: UUID_B, unique: 5, total: 12 });
                expect(result[2]).toEqual({ entityId: UUID_C, unique: 2, total: 5 });
                expect(typeof result[0]?.unique).toBe('number');
                expect(typeof result[0]?.total).toBe('number');
            });

            it('should preserve the ordering returned by the DB (total DESC contract)', async () => {
                // Arrange — DB guarantees ORDER BY total DESC; model preserves it
                const rawRows = [
                    { entityId: UUID_A, unique: '20', total: '100' },
                    { entityId: UUID_B, unique: '8', total: '50' },
                    { entityId: UUID_C, unique: '3', total: '10' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getTopViewedEntities({
                    ...baseInput,
                    entityType: EVENT
                });

                // Assert — totals descending
                const totals = result.map((r) => r.total);
                expect(totals).toEqual([100, 50, 10]);
            });

            it('should return at most `limit` rows (model maps what DB returns)', async () => {
                // Arrange — two rows, limit=2
                const rawRows = [
                    { entityId: UUID_A, unique: '10', total: '30' },
                    { entityId: UUID_B, unique: '5', total: '12' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getTopViewedEntities({
                    entityType: POST,
                    windowDays: 7,
                    limit: 2
                });

                // Assert
                expect(result).toHaveLength(2);
                expect(result.length).toBeLessThanOrEqual(2);
            });
        });

        describe('when the database returns no rows', () => {
            it('should return an empty array', async () => {
                // Arrange
                injectDb(model, buildMockDb([]));

                // Act
                const result = await model.getTopViewedEntities(baseInput);

                // Assert
                expect(result).toEqual([]);
            });
        });

        describe('when the DB returns the node-postgres { rows } shape', () => {
            it('should unwrap the rows property and map correctly', async () => {
                // Arrange
                const rawRows = [{ entityId: UUID_A, unique: '7', total: '20' }];
                injectDb(model, buildMockDbPgShape(rawRows));

                // Act
                const result = await model.getTopViewedEntities({
                    entityType: POST,
                    windowDays: 7,
                    limit: 5
                });

                // Assert
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({ entityId: UUID_A, unique: 7, total: 20 });
            });
        });

        describe('when the database throws', () => {
            it('should propagate the error wrapped as DbError', async () => {
                // Arrange
                injectDb(model, {
                    execute: vi.fn().mockRejectedValue(new Error('connection refused'))
                });

                // Act / Assert
                await expect(model.getTopViewedEntities(baseInput)).rejects.toThrow(
                    'connection refused'
                );
            });
        });
    });

    // =========================================================================
    // getDailySeries
    // =========================================================================

    describe('getDailySeries', () => {
        const baseInput: GetDailySeriesInput = { windowDays: 30 };

        describe('when the database returns rows with valid dates', () => {
            it('should return rows with YYYY-MM-DD date strings', async () => {
                // Arrange
                const rawRows = [
                    { date: '2026-05-10', entityType: 'ACCOMMODATION', total: '5' },
                    { date: '2026-05-10', entityType: 'POST', total: '3' },
                    { date: '2026-05-11', entityType: 'ACCOMMODATION', total: '8' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getDailySeries(baseInput);

                // Assert — all dates match YYYY-MM-DD
                expect(result).toHaveLength(3);
                for (const row of result) {
                    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                }
            });

            it('should coerce string totals to numbers', async () => {
                // Arrange
                const rawRows = [{ date: '2026-06-01', entityType: 'EVENT', total: '42' }];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getDailySeries({ windowDays: 7 });

                // Assert
                expect(result[0]?.total).toBe(42);
                expect(typeof result[0]?.total).toBe('number');
            });

            it('should map entityType from raw string to TrackableEntityType', async () => {
                // Arrange
                const rawRows = [
                    { date: '2026-06-01', entityType: 'POST', total: '10' },
                    { date: '2026-06-01', entityType: 'ACCOMMODATION', total: '20' },
                    { date: '2026-06-01', entityType: 'EVENT', total: '5' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getDailySeries(baseInput);

                // Assert
                const types = result.map((r) => r.entityType);
                expect(types).toContain('POST');
                expect(types).toContain('ACCOMMODATION');
                expect(types).toContain('EVENT');
            });
        });

        describe('gap-fill semantics (model does NOT gap-fill)', () => {
            it('should return only days that have data — no synthetic rows', async () => {
                // Arrange — 3 rows for non-consecutive days; gap-filling is service concern
                const rawRows = [
                    { date: '2026-05-10', entityType: 'ACCOMMODATION', total: '5' },
                    { date: '2026-05-12', entityType: 'POST', total: '3' },
                    { date: '2026-05-15', entityType: 'EVENT', total: '1' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getDailySeries(baseInput);

                // Assert — exactly 3 rows, not 90 (= 3 types × 30 days)
                expect(result).toHaveLength(3);
                const dates = result.map((r) => r.date);
                expect(dates).toEqual(['2026-05-10', '2026-05-12', '2026-05-15']);
            });

            it('should return an empty array when DB has no rows (not 90 zero-rows)', async () => {
                // Arrange
                injectDb(model, buildMockDb([]));

                // Act
                const result = await model.getDailySeries(baseInput);

                // Assert
                expect(result).toEqual([]);
            });
        });

        describe('when the DB returns the node-postgres { rows } shape', () => {
            it('should unwrap the rows property and map correctly', async () => {
                // Arrange
                const rawRows = [{ date: '2026-06-05', entityType: 'ACCOMMODATION', total: '15' }];
                injectDb(model, buildMockDbPgShape(rawRows));

                // Act
                const result = await model.getDailySeries(baseInput);

                // Assert
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    date: '2026-06-05',
                    entityType: 'ACCOMMODATION',
                    total: 15
                });
            });
        });

        describe('when the database throws', () => {
            it('should propagate the error', async () => {
                // Arrange
                injectDb(model, {
                    execute: vi.fn().mockRejectedValue(new Error('timeout'))
                });

                // Act / Assert
                await expect(model.getDailySeries(baseInput)).rejects.toThrow('timeout');
            });
        });
    });

    // =========================================================================
    // getAdminSummaryTotals
    // =========================================================================

    describe('getAdminSummaryTotals', () => {
        const baseInput: GetAdminSummaryTotalsInput = { windowDays: 30 };

        describe('when the database returns rows for multiple entity types', () => {
            it('should normalize to AdminSummaryTotalsRow shape with numeric coercion', async () => {
                // Arrange
                const rawRows = [
                    { entityType: 'ACCOMMODATION', unique: '120', total: '340' },
                    { entityType: 'POST', unique: '55', total: '110' },
                    { entityType: 'EVENT', unique: '30', total: '60' }
                ];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getAdminSummaryTotals(baseInput);

                // Assert
                expect(result).toHaveLength(3);
                expect(result).toContainEqual({
                    entityType: ACCOMMODATION,
                    unique: 120,
                    total: 340
                });
                expect(result).toContainEqual({ entityType: POST, unique: 55, total: 110 });
                expect(result).toContainEqual({ entityType: EVENT, unique: 30, total: 60 });
            });

            it('should coerce string numerics to numbers', async () => {
                // Arrange
                const rawRows = [{ entityType: 'POST', unique: '7', total: '21' }];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getAdminSummaryTotals({ windowDays: 7 });

                // Assert
                expect(typeof result[0]?.unique).toBe('number');
                expect(typeof result[0]?.total).toBe('number');
                expect(result[0]?.unique).toBe(7);
                expect(result[0]?.total).toBe(21);
            });
        });

        describe('when fewer than three entity types are present', () => {
            it('should return only the rows present — zero-fill is a service concern', async () => {
                // Arrange — only ACCOMMODATION has views in the window
                const rawRows = [{ entityType: 'ACCOMMODATION', unique: '5', total: '10' }];
                injectDb(model, buildMockDb(rawRows));

                // Act
                const result = await model.getAdminSummaryTotals(baseInput);

                // Assert — model does NOT add zero rows for POST/EVENT
                expect(result).toHaveLength(1);
                expect(result[0]?.entityType).toBe(ACCOMMODATION);
            });
        });

        describe('when the database returns no rows', () => {
            it('should return an empty array', async () => {
                // Arrange
                injectDb(model, buildMockDb([]));

                // Act
                const result = await model.getAdminSummaryTotals(baseInput);

                // Assert
                expect(result).toEqual([]);
            });
        });

        describe('when the DB returns the node-postgres { rows } shape', () => {
            it('should unwrap the rows property and map correctly', async () => {
                // Arrange
                const rawRows = [{ entityType: 'EVENT', unique: '4', total: '9' }];
                injectDb(model, buildMockDbPgShape(rawRows));

                // Act
                const result = await model.getAdminSummaryTotals({ windowDays: 7 });

                // Assert
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({ entityType: EVENT, unique: 4, total: 9 });
            });
        });

        describe('when the database throws', () => {
            it('should propagate the error', async () => {
                // Arrange
                injectDb(model, {
                    execute: vi.fn().mockRejectedValue(new Error('permission denied'))
                });

                // Act / Assert
                await expect(model.getAdminSummaryTotals(baseInput)).rejects.toThrow(
                    'permission denied'
                );
            });
        });
    });
});
