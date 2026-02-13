import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AmenityModel } from '../../src/models/amenity.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AmenityModel', () => {
    let model: AmenityModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AmenityModel();
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
                amenities: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: '1',
                        name: 'WiFi',
                        accommodations: [{ id: 'a1' }]
                    })
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { accommodations: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({
            id: '1',
            name: 'WiFi',
            accommodations: [{ id: 'a1' }]
        });
        expect(db.query.amenities.findFirst).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'amenities',
            'findWithRelations',
            { where, relations },
            {
                id: '1',
                name: 'WiFi',
                accommodations: [{ id: 'a1' }]
            }
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        getDb.mockReturnValue({});
        const where = { id: '2' };
        const relations = { accommodations: false };
        mockFindOne.mockResolvedValue({ id: '2', name: 'Pool' });
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '2', name: 'Pool' });
        expect(mockFindOne).toHaveBeenCalledWith(where);
        expect(logQuery).toHaveBeenCalledWith(
            'amenities',
            'findWithRelations',
            { where, relations },
            { id: '2', name: 'Pool' }
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            query: {
                amenities: {
                    findFirst: vi.fn().mockRejectedValue(new Error('fail'))
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { accommodations: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'amenities',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (model as any).getTableName();
            expect(tableName).toBe('amenities');
        });
    });

    describe('findAllWithRelations', () => {
        it('should call parent findAllWithRelations with correct table name', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([
                {
                    id: '1',
                    name: 'WiFi',
                    accommodations: [{ id: 'a1', name: 'Hotel Test' }]
                }
            ]);
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(1);

            const db = {
                query: {
                    amenities: {
                        findMany: mockFindMany
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithRelations({
                accommodations: true
            });

            expect(mockFindMany).toHaveBeenCalledWith({
                where: undefined, // buildWhereClause returns undefined for empty object
                with: { accommodations: true },
                limit: 20,
                offset: 0
            });
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toHaveProperty('accommodations');
            expect(logQuery).toHaveBeenCalledWith(
                'amenities',
                'findAllWithRelations',
                expect.objectContaining({
                    where: {},
                    options: expect.objectContaining({
                        page: 1,
                        pageSize: 20
                    }),
                    relations: { accommodations: true }
                }),
                expect.objectContaining({
                    itemCount: 1,
                    total: 1,
                    hasRelations: true
                })
            );

            mockCount.mockRestore();
        });

        it('should handle pagination correctly', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([
                { id: '1', name: 'WiFi' },
                { id: '2', name: 'Pool' }
            ]);
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(10);

            const db = {
                query: {
                    amenities: {
                        findMany: mockFindMany
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithRelations(
                { accommodations: true },
                { name: 'WiFi' },
                { page: 2, pageSize: 3 }
            );

            expect(mockFindMany).toHaveBeenCalledWith({
                where: expect.anything(), // buildWhereClause result - can be complex object or undefined
                with: { accommodations: true },
                limit: 3,
                offset: 3
            });
            expect(result.total).toBe(10);
            expect(result.items).toHaveLength(2);

            mockCount.mockRestore();
        });

        it('should fall back to findAll when no relations specified', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: '1', name: 'WiFi' } as any],
                total: 1
            });

            const result = await model.findAllWithRelations({});

            expect(mockFindAll).toHaveBeenCalledWith({}, {});
            expect(result.items).toHaveLength(1);
            expect(logQuery).toHaveBeenCalledWith(
                'amenities',
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
