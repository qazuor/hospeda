import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AccommodationModel', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AccommodationModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        // Mock findOne fallback
        model.findOne = mockFindOne;
    });

    it('findWithRelations returns result with relations and logs', async () => {
        const db = {
            query: {
                accommodations: {
                    findFirst: vi.fn().mockResolvedValue({ id: '1', destination: { id: 'd1' } })
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { destination: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '1', destination: { id: 'd1' } });
        expect(db.query.accommodations.findFirst).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'accommodations',
            'findWithRelations',
            { where, relations },
            { id: '1', destination: { id: 'd1' } }
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        getDb.mockReturnValue({});
        const where = { id: '2' };
        const relations = { destination: false };
        mockFindOne.mockResolvedValue({ id: '2' });
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '2' });
        expect(mockFindOne).toHaveBeenCalledWith(where);
        expect(logQuery).toHaveBeenCalledWith(
            'accommodations',
            'findWithRelations',
            { where, relations },
            { id: '2' }
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            query: {
                accommodations: {
                    findFirst: vi.fn().mockRejectedValue(new Error('fail'))
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { destination: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'accommodations',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (model as any).getTableName();
            expect(tableName).toBe('accommodations');
        });
    });

    describe('findAllWithRelations', () => {
        it('should call parent findAllWithRelations with correct table name', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([
                {
                    id: '1',
                    name: 'Hotel Test',
                    destination: { id: 'd1', name: 'Destination 1' }
                }
            ]);
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(1);

            const db = {
                query: {
                    accommodations: {
                        findMany: mockFindMany
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithRelations({
                destination: true,
                owner: true
            });

            expect(mockFindMany).toHaveBeenCalledWith({
                where: undefined, // buildWhereClause returns undefined for empty object
                with: { destination: true, owner: true },
                limit: 20,
                offset: 0
            });
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toHaveProperty('destination');
            expect(logQuery).toHaveBeenCalledWith(
                'accommodations',
                'findAllWithRelations',
                expect.objectContaining({
                    relations: { destination: true, owner: true }
                }),
                expect.objectContaining({
                    hasRelations: true,
                    isPaginated: true
                })
            );

            mockCount.mockRestore();
        });

        it('should handle pagination correctly', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([
                { id: '1', destination: { id: 'd1' } },
                { id: '2', destination: { id: 'd2' } }
            ]);
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(10);

            const db = {
                query: {
                    accommodations: {
                        findMany: mockFindMany
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithRelations(
                { destination: true },
                { name: 'Hotel' },
                { page: 2, pageSize: 3 }
            );

            expect(mockFindMany).toHaveBeenCalledWith({
                where: expect.anything(), // buildWhereClause result - can be complex object or undefined
                with: { destination: true },
                limit: 3,
                offset: 3
            });
            expect(result.total).toBe(10);
            expect(result.items).toHaveLength(2);

            mockCount.mockRestore();
        });

        it('should fall back to findAll when no relations specified', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: '1', name: 'Hotel Test' } as any],
                total: 1
            });

            const result = await model.findAllWithRelations({});

            expect(mockFindAll).toHaveBeenCalledWith({}, {});
            expect(result.items).toHaveLength(1);
            expect(logQuery).toHaveBeenCalledWith(
                'accommodations',
                'findAllWithRelations',
                expect.objectContaining({
                    relations: {}
                }),
                'Falling back to findAll - no relations requested'
            );

            mockFindAll.mockRestore();
        });
    });
});
