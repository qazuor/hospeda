import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { EventModel } from '../../src/models/event/event.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('EventModel', () => {
    let model: EventModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new EventModel();
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
        const db = {
            query: {
                events: {
                    findFirst: vi.fn().mockResolvedValue({ id: '1', author: { id: 'a1' } })
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { author: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '1', author: { id: 'a1' } });
        expect(db.query.events.findFirst).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'events',
            'findWithRelations',
            { where, relations },
            { id: '1', author: { id: 'a1' } }
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        getDb.mockReturnValue({});
        const where = { id: '2' };
        const relations = { author: false };
        mockFindOne.mockResolvedValue({ id: '2' });
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '2' });
        expect(mockFindOne).toHaveBeenCalledWith(where, undefined);
        expect(logQuery).toHaveBeenCalledWith(
            'events',
            'findWithRelations',
            { where, relations },
            { id: '2' }
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            query: {
                events: {
                    findFirst: vi.fn().mockRejectedValue(new Error('fail'))
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { author: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'events',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });

    // ========================================================================
    // T-047: tx propagation for EventModel custom methods
    // ========================================================================
    describe('tx propagation', () => {
        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue({ id: '1', author: { id: 'a1' } });
            const mockTx = { query: { events: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ id: '1' }, { author: true }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('findWithRelations() threads tx to findOne in fallback branch', async () => {
            // Arrange
            const mockTx = {} as any;
            const findOneSpy = vi.spyOn(model, 'findOne').mockResolvedValue({ id: '1' } as any);
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ id: '1' }, { author: false }, mockTx);

            // Assert
            expect(findOneSpy).toHaveBeenCalledWith({ id: '1' }, mockTx);

            spy.mockRestore();
            findOneSpy.mockRestore();
        });
    });
});
