/**
 * Unit tests for UserSearchHistoryModel (SPEC-289).
 *
 * Mirrors the shape of userBookmark.model.test.ts: verifies instantiation,
 * table name, and transaction-propagation behaviour via `getClient` mocking.
 * No live DB connection required — Drizzle is mocked at the `getDb` boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { UserSearchHistoryModel } from '../../src/models/user/userSearchHistory.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('UserSearchHistoryModel', () => {
    let model: UserSearchHistoryModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new UserSearchHistoryModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // Construction & shape
    // =========================================================================

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(UserSearchHistoryModel);
        });
    });

    describe('getTableName', () => {
        it('should return the correct internal entity name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('userSearchHistory');
        });
    });

    describe('entityName', () => {
        it('should expose the correct entityName property', () => {
            expect(model.entityName).toBe('userSearchHistory');
        });
    });

    // =========================================================================
    // Transaction propagation
    // =========================================================================

    describe('tx propagation', () => {
        it('findAll() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            $dynamic: vi.fn().mockReturnValue({
                                limit: vi.fn().mockReturnValue({
                                    offset: vi.fn().mockResolvedValue([])
                                })
                            })
                        })
                    })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findAll({}, {}, undefined, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('count() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 5 }])
                    })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            const result = await model.count({}, { tx: mockTx });

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();
            expect(result).toBe(5);

            spy.mockRestore();
        });
    });
});
