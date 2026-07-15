import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { DestinationModel } from '../../src/models/destination/destination.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('DestinationModel', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
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
                destinations: {
                    findFirst: vi
                        .fn()
                        .mockResolvedValue({ id: '1', accommodations: [{ id: 'a1' }] })
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { accommodations: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '1', accommodations: [{ id: 'a1' }] });
        expect(db.query.destinations.findFirst).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findWithRelations',
            { where, relations },
            { id: '1', accommodations: [{ id: 'a1' }] }
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        getDb.mockReturnValue({});
        const where = { id: '2' };
        const relations = { accommodations: false };
        mockFindOne.mockResolvedValue({ id: '2' });
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '2' });
        expect(mockFindOne).toHaveBeenCalledWith(where, undefined);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findWithRelations',
            { where, relations },
            { id: '2' }
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            query: {
                destinations: {
                    findFirst: vi.fn().mockRejectedValue(new Error('fail'))
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { accommodations: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });

    // SPEC-158 regression: 'faqs' must be included in the with-builder loop so
    // that getFaqs() (which calls findWithRelations({ faqs: true })) actually
    // loads the FAQ relation. Previously 'faqs' was registered in
    // validRelationKeys but omitted from the hardcoded with-builder loop, so
    // { faqs: true } was silently dropped, findWithRelations fell back to
    // findOne (which loads no relations), and FAQs never reached the API.
    it('findWithRelations loads the faqs relation (SPEC-158 regression)', async () => {
        const faqs = [{ id: 'faq-1', destinationId: '1', question: 'Q?', answer: 'A' }];
        const findFirst = vi.fn().mockResolvedValue({ id: '1', faqs });
        const db = { query: { destinations: { findFirst } } };
        getDb.mockReturnValue(db);

        const where = { id: '1' };
        const relations = { faqs: true };
        const result = await model.findWithRelations(where, relations);

        // The faqs relation must reach Drizzle's `with` clause carrying the
        // SPEC-177 config (display_order ordering + soft-delete filter), not a
        // bare `true` — that config is what makes the relation load correctly.
        const withArg = (findFirst.mock.calls[0]?.[0] as { with?: Record<string, unknown> })?.with;
        expect(withArg).toHaveProperty('faqs');
        expect(withArg?.faqs).toEqual(
            expect.objectContaining({ where: expect.any(Function), orderBy: expect.any(Function) })
        );
        // It must NOT fall back to findOne, which drops relations entirely.
        expect(mockFindOne).not.toHaveBeenCalled();
        expect(result).toEqual({ id: '1', faqs });
    });
});

// ============================================================================
// T-047: tx propagation for DestinationModel custom methods
// ============================================================================
describe('DestinationModel - tx propagation', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations() uses tx when provided (with relations branch)', async () => {
        // Arrange
        const findFirst = vi.fn().mockResolvedValue({ id: '1', accommodations: [] });
        const mockTx = { query: { destinations: { findFirst } } } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findWithRelations({ id: '1' }, { accommodations: true }, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('findAllByAttractionId() uses tx when provided', async () => {
        // Arrange
        const whereMock = vi.fn().mockResolvedValue([{ destination: { id: 'd1' } }]);
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({ where: whereMock })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findAllByAttractionId('a1', mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('searchWithAttractions() uses tx when provided', async () => {
        // Arrange
        const mockItems = [{ id: 'd1', name: 'Dest' }];
        const orderByMock = vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockItems)
            })
        });
        const _attractionWhereMock = vi.fn().mockResolvedValue([]);
        const attractionOrderByMock = vi.fn().mockResolvedValue([]);
        const mockTx = {
            select: vi
                .fn()
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: orderByMock
                        })
                    })
                })
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                orderBy: attractionOrderByMock
                            })
                        })
                    })
                })
                .mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 1 }])
                    })
                })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.searchWithAttractions({}, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('search() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi
                .fn()
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockReturnValue({
                                    offset: vi.fn().mockResolvedValue([{ id: 'd1' }])
                                })
                            })
                        })
                    })
                })
                .mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 1 }])
                    })
                })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.search({}, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('countByFilters() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 3 }])
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        const result = await model.countByFilters({}, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();
        expect(result.count).toBe(3);

        spy.mockRestore();
    });

    it('findChildren() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue([{ id: 'd2' }])
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findChildren('parent-1', mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('findByPath() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: 'd1', path: '/ar/er' }])
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findByPath('/ar/er', mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('getAttractionsMap() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.getAttractionsMap(['d1'], mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });
});

/**
 * Unit tests for DestinationModel.findAllByAttractionId
 * - Ensures correct join on r_destination_attraction filtering by attractionId (not destinations.id)
 * - Handles empty results and DB errors
 */
describe('DestinationModel.findAllByAttractionId', () => {
    let model: DestinationModel;
    let getDbMock: ReturnType<typeof vi.fn>;
    let logQueryMock: ReturnType<typeof vi.fn>;
    let logErrorMock: ReturnType<typeof vi.fn>;

    const sampleRows = [
        { destination: { id: 'dest-1', name: 'Destination 1' } },
        { destination: { id: 'dest-2', name: 'Destination 2' } }
    ];

    /** Builds a chainable mock for db.select().from().innerJoin().where() */
    function buildSelectChain(finalResolved: unknown[], shouldReject = false) {
        const whereMock = vi
            .fn()
            .mockImplementation(() =>
                shouldReject
                    ? Promise.reject(new Error('DB failure'))
                    : Promise.resolve(finalResolved)
            );
        const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
        const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
        const selectMock = vi.fn().mockReturnValue({ from: fromMock });
        return { selectMock, fromMock, innerJoinMock, whereMock };
    }

    beforeEach(() => {
        model = new DestinationModel();
        vi.clearAllMocks();
        getDbMock = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        logQueryMock = logger.logQuery as ReturnType<typeof vi.fn>;
        logErrorMock = logger.logError as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns destinations linked to the given attractionId via join table (not by own id)', async () => {
        // Arrange
        const { selectMock, innerJoinMock, whereMock } = buildSelectChain(sampleRows);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.findAllByAttractionId('a1');

        // Assert – result is mapped from row.destination
        expect(result).toEqual([
            { id: 'dest-1', name: 'Destination 1' },
            { id: 'dest-2', name: 'Destination 2' }
        ]);
        // Verify the join was made (innerJoin called) and where was called with attractionId filter
        expect(innerJoinMock).toHaveBeenCalled();
        expect(whereMock).toHaveBeenCalled();
        expect(logQueryMock).toHaveBeenCalledWith(
            'destinations',
            'findAllByAttractionId',
            { attractionId: 'a1' },
            expect.any(Array)
        );
    });

    it('returns empty array when no destinations are linked to the given attractionId', async () => {
        // Arrange
        const { selectMock } = buildSelectChain([]);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.findAllByAttractionId('no-match');

        // Assert
        expect(result).toEqual([]);
        expect(logQueryMock).toHaveBeenCalledWith(
            'destinations',
            'findAllByAttractionId',
            { attractionId: 'no-match' },
            []
        );
    });

    it('throws DbError and logs when the database query fails', async () => {
        // Arrange
        const { selectMock } = buildSelectChain([], true);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act & Assert
        await expect(model.findAllByAttractionId('a3')).rejects.toThrow('DB failure');
        expect(logErrorMock).toHaveBeenCalledWith(
            'destinations',
            'findAllByAttractionId',
            { attractionId: 'a3' },
            expect.any(Error)
        );
    });
});

// ============================================================================
// HOS-113 Phase 4 (T-045): DestinationModel.getPointsOfInterestMap
// ============================================================================
describe('DestinationModel.getPointsOfInterestMap', () => {
    let model: DestinationModel;
    let getDbMock: ReturnType<typeof vi.fn>;
    let logErrorMock: ReturnType<typeof vi.fn>;

    /** Builds a chainable mock for db.select().from().innerJoin().where().orderBy() */
    function buildSelectChain(finalResolved: unknown[], shouldReject = false) {
        const orderByMock = vi
            .fn()
            .mockImplementation(() =>
                shouldReject
                    ? Promise.reject(new Error('DB failure'))
                    : Promise.resolve(finalResolved)
            );
        const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
        const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
        const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
        const selectMock = vi.fn().mockReturnValue({ from: fromMock });
        return { selectMock, fromMock, innerJoinMock, whereMock, orderByMock };
    }

    beforeEach(() => {
        model = new DestinationModel();
        vi.clearAllMocks();
        getDbMock = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        logErrorMock = logger.logError as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns an empty map without querying the DB when destIds is empty', async () => {
        // Act
        const result = await model.getPointsOfInterestMap([]);

        // Assert
        expect(result).toEqual(new Map());
        expect(getDbMock).not.toHaveBeenCalled();
    });

    it('groups a single POI under its destination id, preserving the full row shape (HOS-113 review fix)', async () => {
        // Arrange — includes description/isFeatured/isBuiltin, the three fields
        // dropped by the original projection bug (HOS-113 review Fix 1).
        const rows = [
            {
                destinationId: 'dest-1',
                id: 'poi-1',
                slug: 'autodromo',
                lat: -32.48,
                long: -58.24,
                type: 'STADIUM',
                description: 'The regional racing circuit, home to national events.',
                icon: 'flag-checkered',
                isFeatured: true,
                isBuiltin: false,
                displayWeight: 80
            }
        ];
        const { selectMock } = buildSelectChain(rows);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.getPointsOfInterestMap(['dest-1']);

        // Assert — full row shape, not a partial projection: a regression here
        // must fail this assertion, not silently pass on a subset of fields.
        expect(result.get('dest-1')).toEqual([
            {
                id: 'poi-1',
                slug: 'autodromo',
                lat: -32.48,
                long: -58.24,
                type: 'STADIUM',
                description: 'The regional racing circuit, home to national events.',
                icon: 'flag-checkered',
                isFeatured: true,
                isBuiltin: false,
                displayWeight: 80
            }
        ]);
    });

    it('does not throw and preserves null lat/long for a coordinate-less POI (HOS-138 AC-5)', async () => {
        // Arrange — HOS-138 made lat/long nullable; a coordinate-less POI still
        // appears in the map (list card renders, just no map pin). Also carries
        // the new i18n/hasOwnPage fields the destination-detail hydration needs.
        const rows = [
            {
                destinationId: 'dest-1',
                id: 'poi-no-coords',
                slug: 'municipalidad-concordia',
                lat: null,
                long: null,
                type: 'LANDMARK',
                nameI18n: { es: 'Municipalidad', en: 'City Hall', pt: 'Prefeitura' },
                description: null,
                descriptionI18n: null,
                icon: null,
                hasOwnPage: false,
                isFeatured: false,
                isBuiltin: true,
                displayWeight: 50
            }
        ];
        const { selectMock } = buildSelectChain(rows);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.getPointsOfInterestMap(['dest-1']);

        // Assert — no throw, null coordinates preserved as null.
        const entry = result.get('dest-1')?.[0];
        expect(entry?.lat).toBeNull();
        expect(entry?.long).toBeNull();
        expect(entry?.nameI18n).toEqual({ es: 'Municipalidad', en: 'City Hall', pt: 'Prefeitura' });
        expect(entry?.hasOwnPage).toBe(false);
    });

    it('projects nameI18n/descriptionI18n/hasOwnPage into the select() call (HOS-138)', async () => {
        // Arrange — the destination-detail hydration path needs these v2 fields.
        const { selectMock } = buildSelectChain([]);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        await model.getPointsOfInterestMap(['dest-1']);

        // Assert
        expect(selectMock).toHaveBeenCalledWith(
            expect.objectContaining({
                nameI18n: expect.anything(),
                descriptionI18n: expect.anything(),
                hasOwnPage: expect.anything()
            })
        );
    });

    it('projects description/isFeatured/isBuiltin into the select() call itself (HOS-113 review fix)', async () => {
        // Arrange — asserts the query projection, not just the mapped output,
        // so a regression that drops these columns from `.select({...})` is
        // caught even if the (mocked) row happens to carry them anyway.
        const { selectMock } = buildSelectChain([]);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        await model.getPointsOfInterestMap(['dest-1']);

        // Assert
        expect(selectMock).toHaveBeenCalledWith(
            expect.objectContaining({
                description: expect.anything(),
                isFeatured: expect.anything(),
                isBuiltin: expect.anything()
            })
        );
    });

    it('groups multiple POIs across multiple destinations', async () => {
        // Arrange
        const rows = [
            {
                destinationId: 'dest-1',
                id: 'poi-1',
                slug: 'autodromo',
                lat: -32.48,
                long: -58.24,
                type: 'STADIUM',
                icon: null,
                displayWeight: 80
            },
            {
                destinationId: 'dest-2',
                id: 'poi-2',
                slug: 'playa-banco-pelay',
                lat: -32.47,
                long: -58.23,
                type: 'BEACH',
                icon: null,
                displayWeight: 60
            }
        ];
        const { selectMock } = buildSelectChain(rows);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.getPointsOfInterestMap(['dest-1', 'dest-2']);

        // Assert
        expect(result.size).toBe(2);
        expect(result.get('dest-1')?.[0]?.slug).toBe('autodromo');
        expect(result.get('dest-2')?.[0]?.slug).toBe('playa-banco-pelay');
    });

    it('surfaces the same POI (M2M) under every destination it belongs to', async () => {
        // Arrange — one POI row appears twice, once per destinationId (join fan-out)
        const rows = [
            {
                destinationId: 'dest-1',
                id: 'poi-shared',
                slug: 'plaza-regional',
                lat: -32.0,
                long: -58.0,
                type: 'PLAZA',
                icon: null,
                displayWeight: 50
            },
            {
                destinationId: 'dest-2',
                id: 'poi-shared',
                slug: 'plaza-regional',
                lat: -32.0,
                long: -58.0,
                type: 'PLAZA',
                icon: null,
                displayWeight: 50
            }
        ];
        const { selectMock } = buildSelectChain(rows);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.getPointsOfInterestMap(['dest-1', 'dest-2']);

        // Assert
        expect(result.get('dest-1')?.[0]?.id).toBe('poi-shared');
        expect(result.get('dest-2')?.[0]?.id).toBe('poi-shared');
    });

    it('throws DbError and logs when the database query fails', async () => {
        // Arrange
        const { selectMock } = buildSelectChain([], true);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act & Assert
        await expect(model.getPointsOfInterestMap(['dest-1'])).rejects.toThrow('DB failure');
        expect(logErrorMock).toHaveBeenCalledWith(
            'destinations',
            'getPointsOfInterestMap',
            { destIds: ['dest-1'] },
            expect.any(Error)
        );
    });

    it('uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.getPointsOfInterestMap(['dest-1'], mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDbMock).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    // ========================================================================
    // HOS-140: 3-value `relation` filter contract (AC-5)
    // ========================================================================
    describe('relation filter (HOS-140)', () => {
        it('AC-6: defaults to PRIMARY and applies a relation `where` condition when relation is omitted', async () => {
            const { selectMock, whereMock } = buildSelectChain([]);
            getDbMock.mockReturnValue({ select: selectMock });

            await model.getPointsOfInterestMap(['dest-1']);

            // and(...) wraps the conditions into a single SQL expression, so we
            // can only assert the `where` clause was invoked (the relation
            // constraint's presence is exercised end-to-end by the AC-2/AC-6
            // integration tests against real seeded data).
            expect(whereMock).toHaveBeenCalledTimes(1);
        });

        it('projects relation into the select() call', async () => {
            const { selectMock } = buildSelectChain([]);
            getDbMock.mockReturnValue({ select: selectMock });

            await model.getPointsOfInterestMap(['dest-1']);

            expect(selectMock).toHaveBeenCalledWith(
                expect.objectContaining({ relation: expect.anything() })
            );
        });

        it('AC-5: includes relation on every returned row, mixing PRIMARY and NEARBY when relation: ALL', async () => {
            const rows = [
                {
                    destinationId: 'dest-1',
                    id: 'poi-primary',
                    slug: 'poi-primary',
                    lat: -32.0,
                    long: -58.0,
                    type: 'PLAZA',
                    icon: null,
                    displayWeight: 80,
                    relation: 'PRIMARY'
                },
                {
                    destinationId: 'dest-1',
                    id: 'poi-nearby',
                    slug: 'poi-nearby',
                    lat: -32.1,
                    long: -58.1,
                    type: 'PLAZA',
                    icon: null,
                    displayWeight: 50,
                    relation: 'NEARBY'
                }
            ];
            const { selectMock } = buildSelectChain(rows);
            getDbMock.mockReturnValue({ select: selectMock });

            const result = await model.getPointsOfInterestMap(['dest-1'], undefined, 'ALL');

            const entries = result.get('dest-1') ?? [];
            expect(entries).toHaveLength(2);
            expect(entries.find((e) => e.id === 'poi-primary')?.relation).toBe('PRIMARY');
            expect(entries.find((e) => e.id === 'poi-nearby')?.relation).toBe('NEARBY');
        });

        it('AC-5: relation: NEARBY yields only NEARBY rows', async () => {
            const rows = [
                {
                    destinationId: 'dest-1',
                    id: 'poi-nearby',
                    slug: 'poi-nearby',
                    lat: -32.1,
                    long: -58.1,
                    type: 'PLAZA',
                    icon: null,
                    displayWeight: 50,
                    relation: 'NEARBY'
                }
            ];
            const { selectMock } = buildSelectChain(rows);
            getDbMock.mockReturnValue({ select: selectMock });

            const result = await model.getPointsOfInterestMap(['dest-1'], undefined, 'NEARBY');

            const entries = result.get('dest-1') ?? [];
            expect(entries).toHaveLength(1);
            expect(entries[0]?.relation).toBe('NEARBY');
        });
    });

    // ========================================================================
    // HOS-146 review: public-read gate (ACTIVE, non-soft-deleted only)
    // ========================================================================
    describe('public-read gate (HOS-146 review, mirrors HOS-132)', () => {
        /**
         * Walks a drizzle `SQL` tree and collects the names of every column it
         * references plus every bound parameter value, so a `where` clause built
         * with `and(...)` can be asserted structurally (drizzle wraps the
         * conditions into one opaque SQL object — see the AC-6 test above).
         */
        function inspectSql(
            node: unknown,
            acc: { columns: string[]; params: unknown[] }
        ): {
            columns: string[];
            params: unknown[];
        } {
            if (!node || typeof node !== 'object') return acc;
            if (Array.isArray(node)) {
                for (const child of node) inspectSql(child, acc);
                return acc;
            }
            const rec = node as Record<string, unknown>;
            if (typeof rec.name === 'string' && 'table' in rec) acc.columns.push(rec.name);
            if ('value' in rec && !('queryChunks' in rec)) acc.params.push(rec.value);
            if ('queryChunks' in rec) inspectSql(rec.queryChunks, acc);
            return acc;
        }

        it('filters out soft-deleted and non-ACTIVE POIs (a DRAFT/deleted POI must never reach a public response)', async () => {
            // Arrange
            const { selectMock, whereMock } = buildSelectChain([]);
            getDbMock.mockReturnValue({ select: selectMock });

            // Act
            await model.getPointsOfInterestMap(['dest-1'], undefined, 'ALL');

            // Assert — the where clause constrains the POI's own deletedAt and
            // lifecycleState columns, not just the join row's destinationId.
            const { columns, params } = inspectSql(whereMock.mock.calls[0]?.[0], {
                columns: [],
                params: []
            });
            expect(columns).toContain('deleted_at');
            expect(columns).toContain('lifecycle_state');
            expect(params).toContain('ACTIVE');
        });

        it('applies the gate on the default (PRIMARY) relation path too — both callers are public reads', async () => {
            // Arrange
            const { selectMock, whereMock } = buildSelectChain([]);
            getDbMock.mockReturnValue({ select: selectMock });

            // Act — no relation arg: the `_withPointsOfInterest` detail-payload path.
            await model.getPointsOfInterestMap(['dest-1']);

            // Assert
            const { columns } = inspectSql(whereMock.mock.calls[0]?.[0], {
                columns: [],
                params: []
            });
            expect(columns).toContain('deleted_at');
            expect(columns).toContain('lifecycle_state');
        });
    });
});
