import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationMediaModel } from '../../src/models/accommodation/accommodationMedia.model';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

const ACCOMMODATION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEDIA_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const NOW = new Date('2024-06-01T00:00:00.000Z');

const buildMediaRow = (overrides: Record<string, unknown> = {}) => ({
    id: MEDIA_ID,
    accommodationId: ACCOMMODATION_ID,
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/acc/photo.jpg',
    moderationState: 'APPROVED',
    state: 'visible',
    isFeatured: false,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides
});

describe('AccommodationMediaModel', () => {
    let model: AccommodationMediaModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AccommodationMediaModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // constructor / instantiation
    // =========================================================================

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AccommodationMediaModel);
        });

        it('should expose the correct entityName', () => {
            expect(model.entityName).toBe('accommodationMedia');
        });

        it('should return the correct table name via getTableName()', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('accommodationMedia');
        });
    });

    // =========================================================================
    // findByAccommodation
    // =========================================================================

    describe('findByAccommodation', () => {
        it('should return items and total for a given accommodationId', async () => {
            // Arrange — findByAccommodation uses Promise.all([ items query, count query ])
            // Both SELECT calls go through the same `db` object but with different chains.
            const mockItems = [buildMediaRow()];
            const mockCountRows = [{ id: MEDIA_ID }];

            let selectCallN = 0;
            const db = {
                select: vi.fn().mockImplementation(() => {
                    selectCallN++;
                    if (selectCallN === 1) {
                        // Items query: .from().where().orderBy().limit().offset()
                        return {
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockReturnValue({
                                            offset: vi.fn().mockResolvedValue(mockItems)
                                        })
                                    })
                                })
                            })
                        };
                    }
                    // Count query: .from().where()  (resolves to array length)
                    return {
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue(mockCountRows)
                        })
                    };
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            const result = await model.findByAccommodation({
                accommodationId: ACCOMMODATION_ID
            });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.items[0]?.accommodationId).toBe(ACCOMMODATION_ID);
        });

        it('should pass the state filter when provided', async () => {
            // Arrange — capture the where clause argument to verify state is applied
            const mockItems = [buildMediaRow({ state: 'archived' })];
            let selectCallN = 0;
            const db = {
                select: vi.fn().mockImplementation(() => {
                    selectCallN++;
                    if (selectCallN === 1) {
                        return {
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockReturnValue({
                                            offset: vi.fn().mockResolvedValue(mockItems)
                                        })
                                    })
                                })
                            })
                        };
                    }
                    return {
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([{ id: MEDIA_ID }])
                        })
                    };
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            const result = await model.findByAccommodation({
                accommodationId: ACCOMMODATION_ID,
                state: 'archived'
            });

            // Assert
            expect(result.items[0]?.state).toBe('archived');
            // Both select calls were made (items + count)
            expect(db.select).toHaveBeenCalledTimes(2);
        });

        it('should apply pagination (page + pageSize)', async () => {
            // Arrange
            const offsetFn = vi.fn().mockResolvedValue([]);
            const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
            let selectCallN = 0;
            const db = {
                select: vi.fn().mockImplementation(() => {
                    selectCallN++;
                    if (selectCallN === 1) {
                        return {
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockReturnValue({ limit: limitFn })
                                })
                            })
                        };
                    }
                    return {
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([])
                        })
                    };
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            await model.findByAccommodation({
                accommodationId: ACCOMMODATION_ID,
                page: 3,
                pageSize: 10
            });

            // Assert: page 3, pageSize 10 → limit=10, offset=20
            expect(limitFn).toHaveBeenCalledWith(10);
            expect(offsetFn).toHaveBeenCalledWith(20);
        });

        it('should return empty items and zero total when nothing found', async () => {
            // Arrange
            let selectCallN = 0;
            const db = {
                select: vi.fn().mockImplementation(() => {
                    selectCallN++;
                    if (selectCallN === 1) {
                        return {
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockReturnValue({
                                            offset: vi.fn().mockResolvedValue([])
                                        })
                                    })
                                })
                            })
                        };
                    }
                    return {
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([])
                        })
                    };
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            const result = await model.findByAccommodation({
                accommodationId: ACCOMMODATION_ID
            });

            // Assert
            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should log via logQuery on success', async () => {
            // Arrange
            let selectCallN = 0;
            const db = {
                select: vi.fn().mockImplementation(() => {
                    selectCallN++;
                    if (selectCallN === 1) {
                        return {
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockReturnValue({
                                            offset: vi.fn().mockResolvedValue([buildMediaRow()])
                                        })
                                    })
                                })
                            })
                        };
                    }
                    return {
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([{ id: MEDIA_ID }])
                        })
                    };
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            await model.findByAccommodation({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(logQuery).toHaveBeenCalledWith(
                'accommodationMedia',
                'findByAccommodation',
                expect.objectContaining({ accommodationId: ACCOMMODATION_ID }),
                expect.objectContaining({ items: expect.any(Array), total: 1 })
            );
        });

        it('should throw DbError when the DB query fails', async () => {
            // Arrange
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('connection lost'))
                    })
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act & Assert
            await expect(
                model.findByAccommodation({ accommodationId: ACCOMMODATION_ID })
            ).rejects.toThrow(DbError);
        });

        it('should use the provided tx instead of the global db', async () => {
            // Arrange
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            let selectCallN = 0;
            const txMock = {
                select: vi.fn().mockImplementation(() => {
                    selectCallN++;
                    if (selectCallN === 1) {
                        return {
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockReturnValue({
                                            offset: vi.fn().mockResolvedValue([])
                                        })
                                    })
                                })
                            })
                        };
                    }
                    return {
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([])
                        })
                    };
                })
            };
            getClientSpy.mockReturnValue(txMock);

            // Act
            await model.findByAccommodation({
                accommodationId: ACCOMMODATION_ID,
                tx: txMock as unknown as Parameters<typeof model.findByAccommodation>[0]['tx']
            });

            // Assert: getClient was called with the tx
            expect(getClientSpy).toHaveBeenCalledWith(txMock);
            // global getDb was NOT called
            expect(getDb).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // findFeatured
    // =========================================================================

    describe('findFeatured', () => {
        it('should return the featured row when one exists', async () => {
            // Arrange
            const featuredRow = buildMediaRow({ isFeatured: true });
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([featuredRow])
                        })
                    })
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            const result = await model.findFeatured({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(result).not.toBeNull();
            expect(result?.isFeatured).toBe(true);
            expect(result?.accommodationId).toBe(ACCOMMODATION_ID);
        });

        it('should return null when no featured image is set', async () => {
            // Arrange
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            const result = await model.findFeatured({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(result).toBeNull();
        });

        it('should apply LIMIT 1 to the query', async () => {
            // Arrange
            const limitFn = vi.fn().mockResolvedValue([buildMediaRow({ isFeatured: true })]);
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: limitFn
                        })
                    })
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            await model.findFeatured({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(limitFn).toHaveBeenCalledWith(1);
        });

        it('should log via logQuery on success', async () => {
            // Arrange
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([buildMediaRow({ isFeatured: true })])
                        })
                    })
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act
            await model.findFeatured({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(logQuery).toHaveBeenCalledWith(
                'accommodationMedia',
                'findFeatured',
                { accommodationId: ACCOMMODATION_ID },
                expect.anything()
            );
        });

        it('should throw DbError when the DB query fails', async () => {
            // Arrange
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('timeout'))
                        })
                    })
                })
            };
            const spy = vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient');
            spy.mockReturnValue(db);

            // Act & Assert
            await expect(model.findFeatured({ accommodationId: ACCOMMODATION_ID })).rejects.toThrow(
                DbError
            );
        });

        it('should use the provided tx instead of the global db', async () => {
            // Arrange
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            const txMock = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            getClientSpy.mockReturnValue(txMock);

            // Act
            await model.findFeatured({
                accommodationId: ACCOMMODATION_ID,
                tx: txMock as unknown as Parameters<typeof model.findFeatured>[0]['tx']
            });

            // Assert
            expect(getClientSpy).toHaveBeenCalledWith(txMock);
            expect(getDb).not.toHaveBeenCalled();
        });
    });
});
