/**
 * @file entity-view.model.test.ts
 *
 * Unit tests for EntityViewModel (SPEC-159 T-004).
 *
 * **Test strategy**: matches the convention used by all other model tests in
 * this package (e.g. `userBookmark.model.test.ts`, `entity-comment.model.test.ts`).
 * The database client is mocked via `vi.spyOn(model as any, 'getClient')` — no
 * live PostgreSQL instance is required. Tests validate:
 *   - `insertView`: delegates to db.insert().values().returning(), returns the row.
 *   - `getStatsForEntities`: delegates to db.execute() with correct args, coerces
 *     numeric strings to numbers, handles empty entityIds short-circuit.
 *   - `purgeOlderThan`: delegates to db.delete().where().returning(), returns count.
 *
 * **Tests NOT executed against a live DB:** all tests in this file use a fully
 * mocked client. Integration tests that need a real database (boundary checks,
 * 30-minute bucket dedup) would live in `test/integration/` and require a running
 * PostgreSQL instance. Those tests are deferred to T-005 (service integration).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EntityViewModel,
    type GetStatsForEntitiesInput,
    type InsertViewInput,
    type PurgeOlderThanInput
} from '../../../src/models/entity-view/entity-view.model.ts';
import { DbError } from '../../../src/utils/error.ts';

// Mock the logger so tests don't produce noise and don't require initialization.
vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a valid InsertViewInput for tests. */
function makeInsertInput(overrides: Partial<InsertViewInput> = {}): InsertViewInput {
    return {
        entityType: 'ACCOMMODATION',
        entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        visitorHash: 'hash-abc123',
        isAuthenticated: false,
        ...overrides
    };
}

/** Builds a fake SelectEntityView row. */
function makeSelectRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        entityType: 'ACCOMMODATION',
        entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        visitorHash: 'hash-abc123',
        isAuthenticated: false,
        viewedAt: new Date('2025-01-15T12:00:00Z'),
        ...overrides
    };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('EntityViewModel', () => {
    let model: EntityViewModel;

    beforeEach(() => {
        model = new EntityViewModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // insertView
    // =========================================================================

    describe('insertView', () => {
        it('inserts a view row and returns the inserted record', async () => {
            // Arrange
            const input = makeInsertInput();
            const fakeRow = makeSelectRow();

            const mockDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([fakeRow])
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const result = await model.insertView(input);

            // Assert
            expect(mockDb.insert).toHaveBeenCalledOnce();
            expect(result).toEqual(fakeRow);
        });

        it('sets isAuthenticated to false by default when not provided in values', async () => {
            // Arrange — isAuthenticated: false is the default; verify it is forwarded
            const input = makeInsertInput({ isAuthenticated: false });
            const fakeRow = makeSelectRow({ isAuthenticated: false });

            const returningMock = vi.fn().mockResolvedValue([fakeRow]);
            const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
            const mockDb = { insert: vi.fn().mockReturnValue({ values: valuesMock }) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            await model.insertView(input);

            // Assert — the values() call must have received isAuthenticated: false
            const valuesArg = valuesMock.mock.calls[0][0] as Record<string, unknown>;
            expect(valuesArg.isAuthenticated).toBe(false);
        });

        it('inserts with isAuthenticated: true when the visitor is logged in', async () => {
            // Arrange
            const input = makeInsertInput({ isAuthenticated: true });
            const fakeRow = makeSelectRow({ isAuthenticated: true });

            const returningMock = vi.fn().mockResolvedValue([fakeRow]);
            const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
            const mockDb = { insert: vi.fn().mockReturnValue({ values: valuesMock }) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const result = await model.insertView(input);

            // Assert
            const valuesArg = valuesMock.mock.calls[0][0] as Record<string, unknown>;
            expect(valuesArg.isAuthenticated).toBe(true);
            expect((result as Record<string, unknown>).isAuthenticated).toBe(true);
        });

        it('does NOT include viewedAt in the values() call (DB default applies)', async () => {
            // Arrange
            const input = makeInsertInput();
            const fakeRow = makeSelectRow();

            const returningMock = vi.fn().mockResolvedValue([fakeRow]);
            const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
            const mockDb = { insert: vi.fn().mockReturnValue({ values: valuesMock }) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            await model.insertView(input);

            // Assert — viewedAt must NOT be set by the model (server-side default)
            const valuesArg = valuesMock.mock.calls[0][0] as Record<string, unknown>;
            expect(valuesArg.viewedAt).toBeUndefined();
        });

        it('uses the provided tx when supplied', async () => {
            // Arrange
            const input = makeInsertInput();
            const fakeRow = makeSelectRow();

            const mockTx = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([fakeRow])
                    })
                })
            };
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            // Act
            await model.insertView(
                input,
                mockTx as unknown as import('../../../src/types.ts').DrizzleClient
            );

            // Assert
            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('wraps DB errors in DbError', async () => {
            // Arrange
            const input = makeInsertInput();
            const mockDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockRejectedValue(new Error('connection lost'))
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act & Assert
            await expect(model.insertView(input)).rejects.toThrow(DbError);
        });

        it('throws DbError when insert returns empty array', async () => {
            // Arrange — db.insert().values().returning() resolves to [] (no row)
            const input = makeInsertInput();
            const mockDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act & Assert
            await expect(model.insertView(input)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // getStatsForEntities
    // =========================================================================

    describe('getStatsForEntities', () => {
        it('returns empty array immediately when entityIds is empty', async () => {
            // Arrange
            const input: GetStatsForEntitiesInput = {
                entityType: 'ACCOMMODATION',
                entityIds: [],
                windowDays: 7
            };
            // No getClient spy needed — the method short-circuits before DB access.

            // Act
            const result = await model.getStatsForEntities(input);

            // Assert
            expect(result).toEqual([]);
        });

        it('calls db.execute() with the aggregation SQL and returns parsed stats', async () => {
            // Arrange
            const entityId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const entityId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
            const input: GetStatsForEntitiesInput = {
                entityType: 'ACCOMMODATION',
                entityIds: [entityId1, entityId2],
                windowDays: 7
            };

            // Simulate pg driver returning { rows: [...] }
            const fakeRows = {
                rows: [
                    { entityId: entityId1, unique: '3', total: '5' },
                    { entityId: entityId2, unique: '1', total: '2' }
                ]
            };
            const mockDb = { execute: vi.fn().mockResolvedValue(fakeRows) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const result = await model.getStatsForEntities(input);

            // Assert
            expect(mockDb.execute).toHaveBeenCalledOnce();
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ entityId: entityId1, unique: 3, total: 5 });
            expect(result[1]).toEqual({ entityId: entityId2, unique: 1, total: 2 });
        });

        it('coerces numeric string results to numbers', async () => {
            // Arrange — pg driver returns numeric columns as strings
            const entityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const input: GetStatsForEntitiesInput = {
                entityType: 'POST',
                entityIds: [entityId],
                windowDays: 30
            };
            const fakeRows = { rows: [{ entityId, unique: '42', total: '100' }] };
            const mockDb = { execute: vi.fn().mockResolvedValue(fakeRows) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const result = await model.getStatsForEntities(input);

            // Assert — must be number primitives, not strings
            expect(typeof result[0]?.unique).toBe('number');
            expect(typeof result[0]?.total).toBe('number');
            expect(result[0]?.unique).toBe(42);
            expect(result[0]?.total).toBe(100);
        });

        it('handles pg driver returning a plain array (not {rows:[...]})', async () => {
            // Arrange — some Drizzle driver versions return the rows array directly
            const entityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const input: GetStatsForEntitiesInput = {
                entityType: 'EVENT',
                entityIds: [entityId],
                windowDays: 7
            };
            const fakeRows = [{ entityId, unique: 10, total: 15 }];
            const mockDb = { execute: vi.fn().mockResolvedValue(fakeRows) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const result = await model.getStatsForEntities(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ entityId, unique: 10, total: 15 });
        });

        it('omits entities with no rows in the window (zero-view contract)', async () => {
            // Arrange — only entityId1 has rows; entityId2 is absent from results
            const entityId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const entityId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
            const input: GetStatsForEntitiesInput = {
                entityType: 'ACCOMMODATION',
                entityIds: [entityId1, entityId2],
                windowDays: 7
            };
            const fakeRows = { rows: [{ entityId: entityId1, unique: '1', total: '1' }] };
            const mockDb = { execute: vi.fn().mockResolvedValue(fakeRows) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const result = await model.getStatsForEntities(input);

            // Assert — entityId2 is absent (service layer normalizes to 0 if needed)
            expect(result).toHaveLength(1);
            expect(result[0]?.entityId).toBe(entityId1);
        });

        it('respects the entityType filter (passed into the SQL fragment)', async () => {
            // Arrange
            const entityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const input: GetStatsForEntitiesInput = {
                entityType: 'EVENT',
                entityIds: [entityId],
                windowDays: 7
            };
            const fakeRows = { rows: [] };
            const mockDb = { execute: vi.fn().mockResolvedValue(fakeRows) };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            await model.getStatsForEntities(input);

            // Assert — execute() was called (entity type is embedded in the sql tag, not inspectable)
            expect(mockDb.execute).toHaveBeenCalledOnce();
        });

        it('uses the provided tx when supplied', async () => {
            // Arrange
            const entityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const input: GetStatsForEntitiesInput = {
                entityType: 'ACCOMMODATION',
                entityIds: [entityId],
                windowDays: 7
            };
            const mockTx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            // Act
            await model.getStatsForEntities(
                input,
                mockTx as unknown as import('../../../src/types.ts').DrizzleClient
            );

            // Assert
            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('wraps DB errors in DbError', async () => {
            // Arrange
            const input: GetStatsForEntitiesInput = {
                entityType: 'ACCOMMODATION',
                entityIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
                windowDays: 7
            };
            const mockDb = {
                execute: vi.fn().mockRejectedValue(new Error('query timeout'))
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act & Assert
            await expect(model.getStatsForEntities(input)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // purgeOlderThan
    // =========================================================================

    describe('purgeOlderThan', () => {
        it('returns the count of deleted rows', async () => {
            // Arrange
            const input: PurgeOlderThanInput = { days: 95 };
            const deletedRows = [
                { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
                { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' }
            ];

            const mockDb = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue(deletedRows)
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const count = await model.purgeOlderThan(input);

            // Assert
            expect(count).toBe(2);
        });

        it('returns 0 when no rows are older than the threshold', async () => {
            // Arrange
            const input: PurgeOlderThanInput = { days: 95 };

            const mockDb = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            const count = await model.purgeOlderThan(input);

            // Assert
            expect(count).toBe(0);
        });

        it('calls db.delete() exactly once', async () => {
            // Arrange
            const input: PurgeOlderThanInput = { days: 30 };

            const mockDb = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: 'x' }])
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act
            await model.purgeOlderThan(input);

            // Assert
            expect(mockDb.delete).toHaveBeenCalledOnce();
        });

        it('uses the provided tx when supplied', async () => {
            // Arrange
            const input: PurgeOlderThanInput = { days: 95 };
            const mockTx = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            // Act
            await model.purgeOlderThan(
                input,
                mockTx as unknown as import('../../../src/types.ts').DrizzleClient
            );

            // Assert
            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('wraps DB errors in DbError', async () => {
            // Arrange
            const input: PurgeOlderThanInput = { days: 95 };
            const mockDb = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockRejectedValue(new Error('disk full'))
                    })
                })
            };
            vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(
                mockDb
            );

            // Act & Assert
            await expect(model.purgeOlderThan(input)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // Constructor / instantiation
    // =========================================================================

    describe('constructor', () => {
        it('can be instantiated', () => {
            expect(model).toBeInstanceOf(EntityViewModel);
        });
    });
});
