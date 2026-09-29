/**
 * @file entity-view-host-daily-series.model.test.ts
 *
 * Unit tests for {@link EntityViewModel.getDailySeriesForEntityIds} (SPEC-207 §4.1).
 *
 * Verifies:
 *  - Returns an empty array when entityIds is empty (fast-path guard).
 *  - Maps raw DB rows to {@link HostDailySeriesRow} shape with numeric coercion.
 *  - Handles both the plain-array and `{ rows }` pg-driver response shapes.
 *  - Propagates DB errors as DbError (does NOT gap-fill — that is service concern).
 *
 * **Test strategy**: mirrors entity-view-admin.model.test.ts — injects a mock
 * db via `vi.spyOn(model, 'getClient')`. No live PostgreSQL connection required.
 */

import { EntityTypeEnum } from '@repo/schemas';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EntityViewModel,
    type GetDailySeriesForEntityIdsInput
} from '../../../src/models/entity-view/entity-view.model.ts';

// Mock logger so tests produce no noise.
vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const UUID_A = '550e8400-e29b-41d4-a716-446655440001';
const UUID_B = '550e8400-e29b-41d4-a716-446655440002';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MockDb = { execute: ReturnType<typeof vi.fn> };

/** Builds a mock db that returns the plain-array (postgres-js) driver shape. */
function buildMockDb(rows: unknown[]): MockDb {
    return { execute: vi.fn().mockResolvedValue(rows) };
}

/** Builds a mock db that returns the `{ rows: [...] }` node-postgres driver shape. */
function buildMockDbPgShape(rows: unknown[]): MockDb {
    return { execute: vi.fn().mockResolvedValue({ rows }) };
}

/** Injects a mock db client into the model via getClient spy. */
function injectDb(model: EntityViewModel, mockDb: MockDb): void {
    vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(mockDb);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('EntityViewModel.getDailySeriesForEntityIds (SPEC-207)', () => {
    let model: EntityViewModel;

    beforeEach(() => {
        model = new EntityViewModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const baseInput: GetDailySeriesForEntityIdsInput = {
        entityType: EntityTypeEnum.ACCOMMODATION,
        windowDays: 30,
        entityIds: [UUID_A, UUID_B]
    };

    // =========================================================================
    // Fast-path: empty entityIds
    // =========================================================================

    describe('when entityIds is empty', () => {
        it('should return an empty array without calling the database', async () => {
            // Arrange
            const mockDb = buildMockDb([]);
            injectDb(model, mockDb);

            // Act
            const result = await model.getDailySeriesForEntityIds({
                entityType: EntityTypeEnum.ACCOMMODATION,
                windowDays: 30,
                entityIds: []
            });

            // Assert
            expect(result).toEqual([]);
            expect(mockDb.execute).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Happy path — plain-array driver shape
    // =========================================================================

    describe('with plain-array driver response (postgres-js style)', () => {
        it('should map rows to HostDailySeriesRow shape with numeric coercion', async () => {
            // Arrange
            const rawRows = [
                { date: '2026-05-17', total: '5' },
                { date: '2026-05-18', total: '12' }
            ];
            injectDb(model, buildMockDb(rawRows));

            // Act
            const result = await model.getDailySeriesForEntityIds(baseInput);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ date: '2026-05-17', total: 5 });
            expect(result[1]).toEqual({ date: '2026-05-18', total: 12 });
        });

        it('should coerce total to number even when already a number from the driver', async () => {
            // Arrange
            const rawRows = [{ date: '2026-06-01', total: 7 }];
            injectDb(model, buildMockDb(rawRows));

            // Act
            const result = await model.getDailySeriesForEntityIds(baseInput);

            // Assert
            expect(result[0]).toEqual({ date: '2026-06-01', total: 7 });
            expect(typeof result[0]?.total).toBe('number');
        });

        it('should return an empty array when no views exist in the window', async () => {
            // Arrange
            injectDb(model, buildMockDb([]));

            // Act
            const result = await model.getDailySeriesForEntityIds(baseInput);

            // Assert — model does NOT gap-fill; empty is valid
            expect(result).toEqual([]);
        });

        it('should return only days that have views (no gap-fill in model)', async () => {
            // Arrange — only one day in the window has views
            const rawRows = [{ date: '2026-06-10', total: '3' }];
            injectDb(model, buildMockDb(rawRows));

            // Act
            const result = await model.getDailySeriesForEntityIds({
                entityType: EntityTypeEnum.ACCOMMODATION,
                windowDays: 7,
                entityIds: [UUID_A]
            });

            // Assert — model returns only the one row, no gap-fill
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ date: '2026-06-10', total: 3 });
        });
    });

    // =========================================================================
    // Happy path — node-postgres { rows } driver shape
    // =========================================================================

    describe('with node-postgres { rows } driver response', () => {
        it('should map rows from the { rows } shape correctly', async () => {
            // Arrange
            const rawRows = [
                { date: '2026-06-08', total: '10' },
                { date: '2026-06-09', total: '4' }
            ];
            injectDb(model, buildMockDbPgShape(rawRows));

            // Act
            const result = await model.getDailySeriesForEntityIds(baseInput);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ date: '2026-06-08', total: 10 });
            expect(result[1]).toEqual({ date: '2026-06-09', total: 4 });
        });

        it('should handle empty { rows: [] } gracefully', async () => {
            // Arrange
            injectDb(model, buildMockDbPgShape([]));

            // Act
            const result = await model.getDailySeriesForEntityIds(baseInput);

            // Assert
            expect(result).toEqual([]);
        });
    });

    // =========================================================================
    // 7-day window
    // =========================================================================

    describe('with windowDays = 7', () => {
        it('should accept a 7-day window and map rows correctly', async () => {
            // Arrange
            const rawRows = [{ date: '2026-06-14', total: '2' }];
            injectDb(model, buildMockDb(rawRows));

            // Act
            const result = await model.getDailySeriesForEntityIds({
                windowDays: 7,
                entityIds: [UUID_A, UUID_B]
            });

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ date: '2026-06-14', total: 2 });
        });
    });

    // =========================================================================
    // Error handling
    // =========================================================================

    describe('when the database throws', () => {
        it('should propagate the error (does not swallow DB errors)', async () => {
            // Arrange
            injectDb(model, {
                execute: vi.fn().mockRejectedValue(new Error('connection reset'))
            });

            // Act / Assert
            await expect(model.getDailySeriesForEntityIds(baseInput)).rejects.toThrow(
                'connection reset'
            );
        });

        it('should propagate a non-Error rejection', async () => {
            // Arrange
            injectDb(model, {
                execute: vi.fn().mockRejectedValue('timeout')
            });

            // Act / Assert
            await expect(model.getDailySeriesForEntityIds(baseInput)).rejects.toBeDefined();
        });
    });
    // =========================================================================
    // HOS-1265 — entity type is bound into the query, not hardcoded
    // =========================================================================

    describe('entity type filter (HOS-1265)', () => {
        const dialect = new PgDialect();

        /**
         * Stands in for Postgres: it holds views that belong to ONE entity type
         * and answers a query only with rows whose type matches the type BOUND
         * into that query. A hardcoded `'ACCOMMODATION'` literal binds nothing,
         * so a gastronomy request finds no match, exactly as in production.
         */
        function buildTypeAwareDb(storedType: string, storedRows: unknown[]): MockDb {
            return {
                execute: vi.fn().mockImplementation(async (query: never) => {
                    const { sql: text, params } = dialect.sqlToQuery(query);
                    const matches =
                        params.includes(storedType) || text.includes(`'${storedType}'::`);
                    return matches ? storedRows : [];
                })
            };
        }

        it('should return a NON-ZERO total for gastronomy ids', async () => {
            // Arrange
            const mockDb = buildTypeAwareDb(EntityTypeEnum.GASTRONOMY, [
                { date: '2026-09-08', total: '4' }
            ]);
            injectDb(model, mockDb);

            // Act
            const result = await model.getDailySeriesForEntityIds({
                ...baseInput,
                entityType: EntityTypeEnum.GASTRONOMY
            });

            // Assert
            expect(result).toStrictEqual([{ date: '2026-09-08', total: 4 }]);
            expect(result.reduce((sum, row) => sum + row.total, 0)).toBeGreaterThan(0);
        });

        it('should bind the requested entity type as a query parameter', async () => {
            // Arrange
            const mockDb = buildMockDb([]);
            injectDb(model, mockDb);

            // Act
            await model.getDailySeriesForEntityIds({
                ...baseInput,
                entityType: EntityTypeEnum.EXPERIENCE
            });

            // Assert
            const { sql: text, params } = dialect.sqlToQuery(mockDb.execute.mock.calls[0]?.[0]);
            expect(params).toContain(EntityTypeEnum.EXPERIENCE);
            expect(params).not.toContain(EntityTypeEnum.ACCOMMODATION);
            expect(text).not.toContain("'ACCOMMODATION'");
        });
    });
});
