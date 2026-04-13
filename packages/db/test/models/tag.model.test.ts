import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { TagModel } from '../../src/models/tag/tag.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('TagModel', () => {
    let model: TagModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new TagModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        // Mock findOne fallback
        model.findOne = mockFindOne;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (model as any).getTableName();
            expect(tableName).toBe('tags');
        });
    });

    // ========================================================================
    // T-047/T-049: tx propagation for TagModel (base methods via getClient)
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
                                    offset: vi.fn().mockResolvedValue([{ id: 't1' }])
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

    describe('findAllWithRelations', () => {
        it('should call parent findAllWithRelations with correct table name', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([
                {
                    id: '1',
                    name: 'Beach',
                    entityTags: [{ id: 'e1', entityType: 'accommodation' }]
                }
            ]);
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(1);

            const db = {
                query: {
                    tags: {
                        findMany: mockFindMany
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithRelations({
                entityTags: true
            });

            expect(mockFindMany).toHaveBeenCalledWith({
                where: undefined, // buildWhereClause returns undefined for empty object
                with: { entityTags: true },
                limit: 20,
                offset: 0
            });
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toHaveProperty('entityTags');
            expect(logQuery).toHaveBeenCalledWith(
                'tags',
                'findAllWithRelations',
                expect.objectContaining({
                    where: {},
                    options: expect.objectContaining({
                        page: 1,
                        pageSize: 20
                    }),
                    relations: { entityTags: true }
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
                { id: '1', name: 'Beach' },
                { id: '2', name: 'Mountain' }
            ]);
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(10);

            const db = {
                query: {
                    tags: {
                        findMany: mockFindMany
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithRelations(
                { entityTags: true },
                { name: 'Beach' },
                { page: 2, pageSize: 3 }
            );

            expect(mockFindMany).toHaveBeenCalledWith({
                where: expect.anything(), // buildWhereClause result - can be complex object or undefined
                with: { entityTags: true },
                limit: 3,
                offset: 3
            });
            expect(result.total).toBe(10);
            expect(result.items).toHaveLength(2);

            mockCount.mockRestore();
        });

        it('should fall back to findAll when no relations specified', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: '1', name: 'Beach' } as any],
                total: 1
            });

            const result = await model.findAllWithRelations({});

            expect(mockFindAll).toHaveBeenCalledWith({}, {}, undefined, undefined);
            expect(result.items).toHaveLength(1);
            expect(logQuery).toHaveBeenCalledWith(
                'tags',
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
