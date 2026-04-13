import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { UserBookmarkModel } from '../../src/models/user/userBookmark.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('UserBookmarkModel', () => {
    let model: UserBookmarkModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new UserBookmarkModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(UserBookmarkModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('userBookmarks');
        });
    });

    // ========================================================================
    // T-047/T-049: tx propagation (UserBookmarkModel has no custom methods,
    // verify base method getClient receives tx)
    // ========================================================================
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
                        where: vi.fn().mockResolvedValue([{ count: 2 }])
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
            expect(result).toBe(2);

            spy.mockRestore();
        });
    });
});
