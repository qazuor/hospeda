import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PointOfInterestModel } from '../../src/models/destination/point-of-interest.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('PointOfInterestModel', () => {
    let model: PointOfInterestModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new PointOfInterestModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('pointsOfInterest');
        });
    });

    describe('findAll', () => {
        it('should return items and total', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                return Promise.resolve([{ count: '2' }]);
                            }
                            const qb = {
                                limit: () => ({
                                    offset: () =>
                                        Promise.resolve([
                                            { id: '1', slug: 'playa-banco-pelay' },
                                            { id: '2', slug: 'autodromo' }
                                        ])
                                }),
                                $dynamic: () => qb
                            };
                            return qb;
                        }
                    })
                })
            });

            const result = await model.findAll({});

            expect(result).toEqual({
                items: [
                    { id: '1', slug: 'playa-banco-pelay' },
                    { id: '2', slug: 'autodromo' }
                ],
                total: 2
            });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('findById', () => {
        it('should find a point of interest by id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({ limit: () => [{ id: 'poi1', slug: 'museo-entrerriano' }] })
                    })
                })
            });

            const result = await model.findById('poi1');

            expect(result).toEqual({ id: 'poi1', slug: 'museo-entrerriano' });
            expect(logQuery).toHaveBeenCalled();
        });

        it('should return null for non-existent id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({ where: () => ({ limit: () => [] }) })
                })
            });

            const result = await model.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('count', () => {
        it('should return the count', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => Promise.resolve([{ count: '5' }])
                    })
                })
            });

            const result = await model.count({});

            expect(result).toBe(5);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update and return the entity', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({
                            returning: () => [{ id: 'poi1', slug: 'museo-entrerriano-updated' }]
                        })
                    })
                })
            });

            const result = await model.update(
                { id: 'poi1' },
                { slug: 'museo-entrerriano-updated' }
            );

            expect(result).toEqual({ id: 'poi1', slug: 'museo-entrerriano-updated' });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should soft delete and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'poi1' }] })
                    })
                })
            });

            const result = await model.softDelete({ id: 'poi1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'poi1' }] })
                    })
                })
            });

            const result = await model.restore({ id: 'poi1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('should hard delete and return count', async () => {
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({ returning: () => [{ id: 'poi1' }] })
                })
            });

            const result = await model.hardDelete({ id: 'poi1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw DbError on database failure', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => {
                            throw new Error('connection failed');
                        }
                    })
                })
            });

            await expect(model.findAll({})).rejects.toThrow('connection failed');
            expect(logError).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // HOS-113 T-015: findDestinationIdsBySlugs (POI slug -> destinations)
    // ========================================================================
    describe('findDestinationIdsBySlugs', () => {
        it('should return an empty array without a DB round-trip when slugs is empty', async () => {
            const result = await model.findDestinationIdsBySlugs([]);

            expect(result).toEqual([]);
            expect(getDb).not.toHaveBeenCalled();
        });

        it('should resolve slugs to POI ids, then to de-duplicated destination ids', async () => {
            const selectMock = vi
                .fn()
                // First call: points_of_interest.slug IN (...) lookup.
                .mockReturnValueOnce({
                    from: () => ({
                        where: () => Promise.resolve([{ id: 'poi-1' }, { id: 'poi-2' }])
                    })
                })
                // Second call: r_destination_point_of_interest join lookup, with a
                // duplicate destinationId to verify de-duplication.
                .mockReturnValueOnce({
                    from: () => ({
                        innerJoin: () => ({
                            where: () =>
                                Promise.resolve([
                                    { destinationId: 'dest-1' },
                                    { destinationId: 'dest-2' },
                                    { destinationId: 'dest-1' }
                                ])
                        })
                    })
                });
            getDb.mockReturnValue({ select: selectMock });

            const result = await model.findDestinationIdsBySlugs([
                'autodromo',
                'playa_banco_pelay'
            ]);

            expect(result).toEqual(['dest-1', 'dest-2']);
            expect(selectMock).toHaveBeenCalledTimes(2);
            expect(logQuery).toHaveBeenCalled();
        });

        it('should return an empty array and skip the destination query when no POI matches', async () => {
            const selectMock = vi.fn().mockReturnValueOnce({
                from: () => ({
                    where: () => Promise.resolve([])
                })
            });
            getDb.mockReturnValue({ select: selectMock });

            const result = await model.findDestinationIdsBySlugs(['unknown_slug']);

            expect(result).toEqual([]);
            expect(selectMock).toHaveBeenCalledTimes(1);
        });

        it('should throw DbError when the query fails', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => {
                            throw new Error('connection failed');
                        }
                    })
                })
            });

            await expect(model.findDestinationIdsBySlugs(['autodromo'])).rejects.toThrow(
                'connection failed'
            );
            expect(logError).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // HOS-145 T-002 / HOS-182: findWithinRadius (geo query + primaryCategory)
    // ========================================================================
    describe('findWithinRadius', () => {
        const PARAMS = { lat: -32.48, long: -58.24, radiusKm: 5, limit: 12 };

        /**
         * Builds a chainable mock for
         * `db.select().from().leftJoin().leftJoin().where().orderBy().limit()`
         * (HOS-182 added the two `leftJoin`s that resolve each POI's primary
         * category via `r_poi_category` / `poi_categories`).
         */
        function buildSelectChain(finalRows: unknown[], shouldReject = false) {
            const limitMock = vi
                .fn()
                .mockImplementation(() =>
                    shouldReject
                        ? Promise.reject(new Error('connection failed'))
                        : Promise.resolve(finalRows)
                );
            const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
            const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
            const leftJoinMock2 = vi.fn().mockReturnValue({ where: whereMock });
            const leftJoinMock1 = vi.fn().mockReturnValue({ leftJoin: leftJoinMock2 });
            const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoinMock1 });
            const selectMock = vi.fn().mockReturnValue({ from: fromMock });
            return {
                selectMock,
                fromMock,
                leftJoinMock1,
                leftJoinMock2,
                whereMock,
                orderByMock,
                limitMock
            };
        }

        it('resolves primaryCategory to {slug, nameI18n} for a POI with a primary category row', async () => {
            const rows = [
                {
                    id: 'poi-1',
                    slug: 'autodromo',
                    lat: -32.48,
                    long: -58.24,
                    type: 'STADIUM',
                    icon: null,
                    displayWeight: 80,
                    distanceKm: '1.23',
                    primaryCategorySlug: 'sports_venue',
                    primaryCategoryNameI18n: {
                        es: 'Recinto deportivo',
                        en: 'Sports venue',
                        pt: 'Recinto esportivo'
                    }
                }
            ];
            const { selectMock } = buildSelectChain(rows);
            getDb.mockReturnValue({ select: selectMock });

            const result = await model.findWithinRadius(PARAMS);

            expect(result).toHaveLength(1);
            expect(result[0]?.primaryCategory).toEqual({
                slug: 'sports_venue',
                nameI18n: { es: 'Recinto deportivo', en: 'Sports venue', pt: 'Recinto esportivo' }
            });
            // distanceKm is still coerced to a number alongside primaryCategory.
            expect(result[0]?.distanceKm).toBe(1.23);
        });

        it('resolves primaryCategory to null for a POI with no category rows at all', async () => {
            const rows = [
                {
                    id: 'poi-no-categories',
                    slug: 'plaza-sin-categoria',
                    lat: -32.0,
                    long: -58.0,
                    type: 'PLAZA',
                    icon: null,
                    displayWeight: 50,
                    distanceKm: '2.5',
                    primaryCategorySlug: null,
                    primaryCategoryNameI18n: null
                }
            ];
            const { selectMock } = buildSelectChain(rows);
            getDb.mockReturnValue({ select: selectMock });

            const result = await model.findWithinRadius(PARAMS);

            expect(result[0]?.primaryCategory).toBeNull();
        });

        it('resolves primaryCategory to null for a POI with category rows but none marked primary (dirty data, HOS-177)', async () => {
            // The LEFT JOIN's ON condition filters r_poi_category to
            // isPrimary = true — a POI whose category rows are all
            // isPrimary = false never matches that join, so the DB layer
            // returns the same null-slug shape as "no categories at all".
            const rows = [
                {
                    id: 'poi-no-primary',
                    slug: 'museo-sin-primaria',
                    lat: -32.1,
                    long: -58.1,
                    type: 'MUSEUM',
                    icon: null,
                    displayWeight: 40,
                    distanceKm: '3.1',
                    primaryCategorySlug: null,
                    primaryCategoryNameI18n: null
                }
            ];
            const { selectMock } = buildSelectChain(rows);
            getDb.mockReturnValue({ select: selectMock });

            const result = await model.findWithinRadius(PARAMS);

            expect(result[0]?.primaryCategory).toBeNull();
        });

        it('chains two leftJoin calls (r_poi_category, poi_categories) after from()', async () => {
            const { selectMock, fromMock, leftJoinMock1 } = buildSelectChain([]);
            getDb.mockReturnValue({ select: selectMock });

            await model.findWithinRadius(PARAMS);

            expect(fromMock).toHaveBeenCalledTimes(1);
            expect(leftJoinMock1).toHaveBeenCalledTimes(1);
        });

        it('projects primaryCategorySlug/primaryCategoryNameI18n into the select() call', async () => {
            const { selectMock } = buildSelectChain([]);
            getDb.mockReturnValue({ select: selectMock });

            await model.findWithinRadius(PARAMS);

            expect(selectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    primaryCategorySlug: expect.anything(),
                    primaryCategoryNameI18n: expect.anything()
                })
            );
        });

        it('should throw DbError when the query fails', async () => {
            const { selectMock } = buildSelectChain([], true);
            getDb.mockReturnValue({ select: selectMock });

            await expect(model.findWithinRadius(PARAMS)).rejects.toThrow('connection failed');
            expect(logError).toHaveBeenCalled();
        });
    });
});
