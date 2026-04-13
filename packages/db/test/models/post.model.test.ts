import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PostModel } from '../../src/models/post/post.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe('PostModel', () => {
    let model: PostModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new PostModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        model.findOne = mockFindOne;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations returns result with relations and logs', async () => {
        const mockResult = [{ id: '1', author: { id: 'a1' } }];
        const db = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue(mockResult)
                    })
                })
            })
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { author: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '1', author: { id: 'a1' } });
        expect(db.select).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'posts',
            'findWithRelations',
            { where, relations },
            mockResult
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        // Mock db.select to throw an error, so it falls back to findOne
        const db = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockRejectedValue(new Error('db error'))
                    })
                })
            })
        };
        getDb.mockReturnValue(db);
        const where = { id: '2' };
        const relations = { author: false };
        mockFindOne.mockResolvedValue({ id: '2' });

        await expect(model.findWithRelations(where, relations)).rejects.toThrow();
        expect(logError).toHaveBeenCalledWith(
            'posts',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockRejectedValue(new Error('fail'))
                    })
                })
            })
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { author: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'posts',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });

    // ========================================================================
    // T-047: tx propagation for PostModel custom methods
    // ========================================================================
    describe('tx propagation', () => {
        it('incrementLikes() uses tx when provided', async () => {
            // Arrange
            const whereMock = vi.fn().mockResolvedValue([]);
            const mockTx = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ where: whereMock })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.incrementLikes({ id: 'post-1' }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('decrementLikes() uses tx when provided', async () => {
            // Arrange
            const whereMock = vi.fn().mockResolvedValue([]);
            const mockTx = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({ where: whereMock })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.decrementLikes({ id: 'post-1' }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });
    });
});
