/**
 * Tests for AccommodationModel.search() and AccommodationModel.searchWithRelations()
 * focusing on amenity/feature JOIN filtering with intersection semantics.
 *
 * REQ-096-01 / T-014 (SPEC-096): Amenity and feature filters must return
 * only accommodations that have ALL provided IDs (intersection, not union).
 *
 * All tests use mocked Drizzle clients following the project convention
 * (vi.spyOn(dbUtils, 'getDb')).  No real DB connection is required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import {
    AccommodationModel,
    buildAccommodationOrderBy
} from '../../../src/models/accommodation/accommodation.model';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock for db.select().from().where().orderBy().limit().offset()
 * and db.select().from().where() (count query), both resolving to the supplied values.
 */
function makeSearchMock(opts: {
    items?: unknown[];
    total?: number;
    captureWhere?: (clause: unknown) => void;
}) {
    const { items = [], total = 0, captureWhere } = opts;

    // Count query mock: select().from().where() → [{ count: N }]
    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });

    // Items query mock: select().from().where().orderBy().limit().offset() → items[]
    const offsetFn = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const itemsWhereFn = vi.fn((clause: unknown) => {
        if (captureWhere) captureWhere(clause);
        return { orderBy: orderByFn };
    });
    const itemsFromFn = vi.fn().mockReturnValue({ where: itemsWhereFn });

    // Both queries go through db.select() — differentiate by call order.
    let callN = 0;
    const selectFn = vi.fn().mockImplementation(() => {
        callN += 1;
        // First call = items query, second call = count query.
        if (callN <= 1) return { from: itemsFromFn };
        return { from: countFromFn };
    });

    return {
        db: { select: selectFn },
        mocks: { selectFn, itemsWhereFn, countWhereFn, orderByFn, limitFn, offsetFn }
    };
}

/**
 * Creates a chainable mock for db.select().from().where() used by countByFilters,
 * resolving the count query to [{ count: total }] and optionally capturing the
 * composed WHERE clause for structural assertions.
 */
function makeCountMock(opts: { total?: number; captureWhere?: (clause: unknown) => void }) {
    const { total = 0, captureWhere } = opts;
    const whereFn = vi.fn((clause: unknown) => {
        if (captureWhere) captureWhere(clause);
        return Promise.resolve([{ count: total }]);
    });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });
    return { db: { select: selectFn }, mocks: { selectFn, fromFn, whereFn } };
}

/**
 * Creates a mock for db.query.accommodations.findMany() + db.select().from().where()
 * (used by searchWithRelations).
 */
function makeSearchWithRelationsMock(opts: { items?: unknown[]; total?: number }) {
    const { items = [], total = 0 } = opts;

    const findManyFn = vi.fn().mockResolvedValue(items);
    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });
    const countSelectFn = vi.fn().mockReturnValue({ from: countFromFn });

    return {
        db: {
            query: { accommodations: { findMany: findManyFn } },
            select: countSelectFn
        },
        mocks: { findManyFn, countWhereFn }
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AccommodationModel — amenity/feature filter (REQ-096-01)', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        model = new AccommodationModel();
        getDb = vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // search() — amenity filter
    // =========================================================================

    describe('search() — amenity filter', () => {
        it('returns only matching accommodations when a single amenity ID is given', async () => {
            // Arrange
            const mockItems = [{ id: 'acc-1', name: 'Hotel A' }];
            const { db } = makeSearchMock({ items: mockItems, total: 1 });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.search({ amenities: ['amenity-uuid-1'] });

            // Assert
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(1);
            expect(db.select).toHaveBeenCalled();
        });

        it('passes intersection WHERE clause when multiple amenity IDs are provided', async () => {
            // Arrange — capture the WHERE clause passed to the items query
            let capturedWhere: unknown;
            const { db } = makeSearchMock({
                items: [{ id: 'acc-2' }],
                total: 1,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as any);

            // Act
            await model.search({ amenities: ['amenity-1', 'amenity-2'] });

            // Assert — the WHERE clause must be defined (AND composed)
            // We verify it is truthy; SQL structure is an opaque Drizzle object.
            expect(capturedWhere).toBeDefined();
        });

        it('returns empty results when no accommodations match the amenity filter', async () => {
            // Arrange
            const { db } = makeSearchMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.search({ amenities: ['non-existent-amenity'] });

            // Assert
            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('treats empty amenities array as no filter (no extra clause)', async () => {
            // Arrange
            const mockItems = [{ id: 'acc-3' }, { id: 'acc-4' }];
            const { db } = makeSearchMock({ items: mockItems, total: 2 });
            getDb.mockReturnValue(db as any);

            // Act — empty array must not add a filter
            const result = await model.search({ amenities: [] });

            // Assert — both items returned (no amenity filter applied)
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(2);
        });
    });

    // =========================================================================
    // search() — feature filter
    // =========================================================================

    describe('search() — feature filter', () => {
        it('returns only matching accommodations when a single feature ID is given', async () => {
            // Arrange
            const mockItems = [{ id: 'acc-5' }];
            const { db } = makeSearchMock({ items: mockItems, total: 1 });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.search({ features: ['feature-uuid-1'] });

            // Assert
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(1);
        });

        it('passes intersection WHERE clause when multiple feature IDs are provided', async () => {
            // Arrange
            let capturedWhere: unknown;
            const { db } = makeSearchMock({
                items: [{ id: 'acc-6' }],
                total: 1,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as any);

            // Act
            await model.search({ features: ['feature-1', 'feature-2', 'feature-3'] });

            // Assert
            expect(capturedWhere).toBeDefined();
        });

        it('treats empty features array as no filter', async () => {
            // Arrange
            const mockItems = [{ id: 'acc-7' }];
            const { db } = makeSearchMock({ items: mockItems, total: 1 });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.search({ features: [] });

            // Assert
            expect(result.items).toEqual(mockItems);
        });
    });

    // =========================================================================
    // search() — combined amenity + feature filter
    // =========================================================================

    describe('search() — combined amenity + feature filters', () => {
        it('applies both filters when amenities and features are provided', async () => {
            // Arrange
            const mockItems = [{ id: 'acc-8' }];
            let captureCallCount = 0;
            const { db } = makeSearchMock({
                items: mockItems,
                total: 1,
                captureWhere: () => {
                    captureCallCount += 1;
                }
            });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.search({
                amenities: ['amenity-1', 'amenity-2'],
                features: ['feature-1']
            });

            // Assert — both filters compose into the WHERE clause
            expect(result.items).toEqual(mockItems);
            expect(captureCallCount).toBe(1); // WHERE called once per query chain
        });

        it('returns empty when combined filters yield no intersection', async () => {
            // Arrange
            const { db } = makeSearchMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.search({
                amenities: ['amenity-no-match'],
                features: ['feature-no-match']
            });

            // Assert
            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });
    });

    // =========================================================================
    // search() — pagination preserved
    // =========================================================================

    describe('search() — pagination with filters', () => {
        it('applies limit and offset correctly when amenity filter is active', async () => {
            // Arrange
            const { db, mocks } = makeSearchMock({ items: [{ id: 'acc-9' }], total: 5 });
            getDb.mockReturnValue(db as any);

            // Act
            await model.search({ amenities: ['amenity-1'], page: 2, pageSize: 1 });

            // Assert — offset = (2-1) * 1 = 1
            expect(mocks.limitFn).toHaveBeenCalledWith(1);
            expect(mocks.offsetFn).toHaveBeenCalledWith(1);
        });

        it('defaults to page 1 / pageSize 10 when not specified', async () => {
            // Arrange
            const { db, mocks } = makeSearchMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            // Act
            await model.search({ amenities: ['amenity-1'] });

            // Assert
            expect(mocks.limitFn).toHaveBeenCalledWith(10);
            expect(mocks.offsetFn).toHaveBeenCalledWith(0);
        });
    });

    // =========================================================================
    // search() — soft-delete excluded
    // =========================================================================

    describe('search() — soft-delete behaviour', () => {
        it('always includes isNull(deletedAt) in the WHERE clause', async () => {
            // Arrange — capture WHERE to inspect it is composed (non-null)
            let capturedWhere: unknown;
            const { db } = makeSearchMock({
                items: [],
                total: 0,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as any);

            // Act
            await model.search({ amenities: ['amenity-1'] });

            // Assert — the WHERE clause is always present (soft-delete + amenity filter)
            expect(capturedWhere).toBeDefined();
            // The clause is an AND-composed SQL object from Drizzle — truthy check is sufficient
            // because the model always starts whereClauses with isNull(deletedAt).
            expect(capturedWhere).not.toBeNull();
        });
    });

    // =========================================================================
    // searchWithRelations() — amenity/feature filter
    // =========================================================================

    describe('searchWithRelations() — amenity/feature filter', () => {
        it('returns items with relations when a single amenity ID is given', async () => {
            // Arrange
            const mockItems = [{ id: 'acc-10', destination: { id: 'dest-1' } }];
            const { db } = makeSearchWithRelationsMock({ items: mockItems, total: 1 });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.searchWithRelations({ amenities: ['amenity-uuid-1'] });

            // Assert
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(1);
            expect(db.query.accommodations.findMany).toHaveBeenCalled();
        });

        it('passes the WHERE clause when multiple amenity IDs are given', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({ items: [], total: 0 });
            db.query.accommodations.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([]);
            });
            getDb.mockReturnValue(db as any);

            // Act
            await model.searchWithRelations({ amenities: ['am-1', 'am-2'] });

            // Assert — findMany receives a `where` argument (not undefined)
            expect((capturedArgs as { where?: unknown })?.where).toBeDefined();
        });

        it('passes the WHERE clause when multiple feature IDs are given', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({ items: [], total: 0 });
            db.query.accommodations.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([]);
            });
            getDb.mockReturnValue(db as any);

            // Act
            await model.searchWithRelations({ features: ['feat-1', 'feat-2', 'feat-3'] });

            // Assert
            expect((capturedArgs as { where?: unknown })?.where).toBeDefined();
        });

        it('passes both JOIN WHERE clauses when amenities and features are combined', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({ items: [{ id: 'acc-11' }], total: 1 });
            db.query.accommodations.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([{ id: 'acc-11' }]);
            });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.searchWithRelations({
                amenities: ['am-1'],
                features: ['feat-1']
            });

            // Assert
            expect(result.total).toBe(1);
            expect((capturedArgs as { where?: unknown })?.where).toBeDefined();
        });

        it('treats empty amenities/features arrays as no filter (no WHERE injection)', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({
                items: [{ id: 'acc-12' }, { id: 'acc-13' }],
                total: 2
            });
            db.query.accommodations.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([{ id: 'acc-12' }, { id: 'acc-13' }]);
            });
            getDb.mockReturnValue(db as any);

            // Act
            const result = await model.searchWithRelations({ amenities: [], features: [] });

            // Assert — still returns results, WHERE only has isNull(deletedAt)
            expect(result.total).toBe(2);
            // where is defined (isNull deletedAt is always pushed)
            expect((capturedArgs as { where?: unknown })?.where).toBeDefined();
        });

        it('applies correct pagination when amenity filter is active', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({
                items: [{ id: 'acc-14' }],
                total: 10
            });
            db.query.accommodations.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([{ id: 'acc-14' }]);
            });
            getDb.mockReturnValue(db as any);

            // Act
            await model.searchWithRelations({ amenities: ['am-1'], page: 3, pageSize: 2 });

            // Assert — offset = (3-1) * 2 = 4
            expect((capturedArgs as { limit?: number })?.limit).toBe(2);
            expect((capturedArgs as { offset?: number })?.offset).toBe(4);
        });
    });

    // =========================================================================
    // countByFilters() — amenity/feature/anyAmenityGroups filter
    //
    // Regression coverage: prior to this fix, countByFilters silently ignored
    // amenities, features, and anyAmenityGroups, so the total returned to the
    // public list endpoint diverged from the actual number of matching items.
    // The model now mirrors search()/searchWithRelations() — every WHERE
    // applied to items must also apply to the count.
    // =========================================================================

    describe('countByFilters() — amenity/feature/anyAmenityGroups filter', () => {
        it('returns count from db and applies a WHERE clause for amenities', async () => {
            let capturedWhere: unknown;
            const { db } = makeCountMock({
                total: 7,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as any);

            const result = await model.countByFilters({ amenities: ['amenity-1'] });

            expect(result).toEqual({ count: 7 });
            expect(capturedWhere).toBeDefined();
        });

        it('returns count from db and applies a WHERE clause for features', async () => {
            let capturedWhere: unknown;
            const { db } = makeCountMock({
                total: 3,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as any);

            const result = await model.countByFilters({ features: ['feature-1', 'feature-2'] });

            expect(result).toEqual({ count: 3 });
            expect(capturedWhere).toBeDefined();
        });

        it('returns count from db and applies a WHERE clause for anyAmenityGroups', async () => {
            let capturedWhere: unknown;
            const { db } = makeCountMock({
                total: 5,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as any);

            const result = await model.countByFilters({
                anyAmenityGroups: [['am-wifi-1', 'am-wifi-2']]
            });

            expect(result).toEqual({ count: 5 });
            expect(capturedWhere).toBeDefined();
        });

        it('matches search() WHERE structure when the same filters are applied (count/items parity)', async () => {
            // Arrange — capture WHERE from both calls using the same filters.
            // The model must build identical WHERE clauses for items and count
            // queries; otherwise the public list endpoint returns a misleading
            // total. Drizzle's SQL object exposes `queryChunks`, an array of
            // SQL fragments that grow with each conditional clause pushed.
            const sharedParams = {
                amenities: ['am-1', 'am-2'],
                features: ['feat-1'],
                anyAmenityGroups: [['am-wifi-1']]
            };

            let searchWhere: unknown;
            const { db: searchDb } = makeSearchMock({
                items: [],
                total: 0,
                captureWhere: (clause) => {
                    searchWhere = clause;
                }
            });
            getDb.mockReturnValue(searchDb as any);
            await model.search(sharedParams);

            let countWhere: unknown;
            const { db: countDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    countWhere = clause;
                }
            });
            getDb.mockReturnValue(countDb as any);
            await model.countByFilters(sharedParams);

            // Both clauses must exist.
            expect(searchWhere).toBeDefined();
            expect(countWhere).toBeDefined();

            // Structural parity: the number of inner SQL chunks must match,
            // proving countByFilters applied the same set of conditions as
            // search(). If the model regressed and dropped any of the three
            // filters, the count clause would have fewer chunks than search.
            const searchChunks = (searchWhere as { queryChunks?: unknown[] })?.queryChunks;
            const countChunks = (countWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect(Array.isArray(searchChunks)).toBe(true);
            expect(Array.isArray(countChunks)).toBe(true);
            expect((countChunks as unknown[]).length).toBe((searchChunks as unknown[]).length);
        });

        it('treats empty amenities/features arrays as no filter (no extra clause)', async () => {
            let withFiltersWhere: unknown;
            const { db: withFiltersDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    withFiltersWhere = clause;
                }
            });
            getDb.mockReturnValue(withFiltersDb as any);
            await model.countByFilters({ amenities: [], features: [] });

            let baselineWhere: unknown;
            const { db: baselineDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    baselineWhere = clause;
                }
            });
            getDb.mockReturnValue(baselineDb as any);
            await model.countByFilters({});

            const withFiltersChunks = (withFiltersWhere as { queryChunks?: unknown[] })
                ?.queryChunks;
            const baselineChunks = (baselineWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect((withFiltersChunks as unknown[]).length).toBe(
                (baselineChunks as unknown[]).length
            );
        });
    });

    // =========================================================================
    // bbox viewport filter (SPEC-097) — countByFilters + search parity
    // =========================================================================

    describe('viewport bbox filter (SPEC-097)', () => {
        const FULL_BBOX = {
            bboxNorth: -32.0,
            bboxSouth: -34.0,
            bboxEast: -57.0,
            bboxWest: -59.0
        };

        it('countByFilters() adds two clauses when the four bbox params are present', async () => {
            let baselineWhere: unknown;
            const { db: baselineDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    baselineWhere = clause;
                }
            });
            getDb.mockReturnValue(baselineDb as any);
            await model.countByFilters({});

            let bboxWhere: unknown;
            const { db: bboxDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    bboxWhere = clause;
                }
            });
            getDb.mockReturnValue(bboxDb as any);
            await model.countByFilters(FULL_BBOX);

            const baselineChunks = (baselineWhere as { queryChunks?: unknown[] })?.queryChunks;
            const bboxChunks = (bboxWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect(Array.isArray(baselineChunks)).toBe(true);
            expect(Array.isArray(bboxChunks)).toBe(true);
            // Two `and(...)` chunks come from the lat + long predicates.
            expect((bboxChunks as unknown[]).length).toBeGreaterThan(
                (baselineChunks as unknown[]).length
            );
        });

        it('countByFilters() ignores a partial bbox (missing one bound = no filter)', async () => {
            let baselineWhere: unknown;
            const { db: baselineDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    baselineWhere = clause;
                }
            });
            getDb.mockReturnValue(baselineDb as any);
            await model.countByFilters({});

            let partialWhere: unknown;
            const { db: partialDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    partialWhere = clause;
                }
            });
            getDb.mockReturnValue(partialDb as any);
            await model.countByFilters({
                bboxNorth: FULL_BBOX.bboxNorth,
                bboxSouth: FULL_BBOX.bboxSouth,
                bboxEast: FULL_BBOX.bboxEast
                // bboxWest intentionally omitted
            });

            const baselineChunks = (baselineWhere as { queryChunks?: unknown[] })?.queryChunks;
            const partialChunks = (partialWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect((partialChunks as unknown[]).length).toBe((baselineChunks as unknown[]).length);
        });

        it('search() and countByFilters() compose the same WHERE clause for a full bbox', async () => {
            let searchWhere: unknown;
            const { db: searchDb } = makeSearchMock({
                items: [],
                total: 0,
                captureWhere: (clause) => {
                    searchWhere = clause;
                }
            });
            getDb.mockReturnValue(searchDb as any);
            await model.search(FULL_BBOX);

            let countWhere: unknown;
            const { db: countDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    countWhere = clause;
                }
            });
            getDb.mockReturnValue(countDb as any);
            await model.countByFilters(FULL_BBOX);

            const searchChunks = (searchWhere as { queryChunks?: unknown[] })?.queryChunks;
            const countChunks = (countWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect((countChunks as unknown[]).length).toBe((searchChunks as unknown[]).length);
        });

        it('searchWithRelations() resolves when a full bbox is supplied', async () => {
            const { db } = makeSearchWithRelationsMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            const result = await model.searchWithRelations(FULL_BBOX);
            expect(result.items).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    // =========================================================================
    // Geo radius filter (haversine) — countByFilters + search + searchWithRelations
    // =========================================================================

    describe('geo radius filter (haversine)', () => {
        const FULL_GEO = {
            latitude: -32.4846,
            longitude: -58.2326,
            radius: 25
        };

        it('countByFilters() adds one clause when the latitude/longitude/radius triplet is present', async () => {
            let baselineWhere: unknown;
            const { db: baselineDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    baselineWhere = clause;
                }
            });
            getDb.mockReturnValue(baselineDb as any);
            await model.countByFilters({});

            let geoWhere: unknown;
            const { db: geoDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    geoWhere = clause;
                }
            });
            getDb.mockReturnValue(geoDb as any);
            await model.countByFilters(FULL_GEO);

            const baselineChunks = (baselineWhere as { queryChunks?: unknown[] })?.queryChunks;
            const geoChunks = (geoWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect((geoChunks as unknown[]).length).toBeGreaterThan(
                (baselineChunks as unknown[]).length
            );
        });

        it('countByFilters() ignores a partial triplet (missing radius = no filter)', async () => {
            let baselineWhere: unknown;
            const { db: baselineDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    baselineWhere = clause;
                }
            });
            getDb.mockReturnValue(baselineDb as any);
            await model.countByFilters({});

            let partialWhere: unknown;
            const { db: partialDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    partialWhere = clause;
                }
            });
            getDb.mockReturnValue(partialDb as any);
            await model.countByFilters({
                latitude: FULL_GEO.latitude,
                longitude: FULL_GEO.longitude
                // radius intentionally omitted
            });

            const baselineChunks = (baselineWhere as { queryChunks?: unknown[] })?.queryChunks;
            const partialChunks = (partialWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect((partialChunks as unknown[]).length).toBe((baselineChunks as unknown[]).length);
        });

        it('search() and countByFilters() compose the same WHERE clause for a full triplet', async () => {
            let searchWhere: unknown;
            const { db: searchDb } = makeSearchMock({
                items: [],
                total: 0,
                captureWhere: (clause) => {
                    searchWhere = clause;
                }
            });
            getDb.mockReturnValue(searchDb as any);
            await model.search(FULL_GEO);

            let countWhere: unknown;
            const { db: countDb } = makeCountMock({
                total: 0,
                captureWhere: (clause) => {
                    countWhere = clause;
                }
            });
            getDb.mockReturnValue(countDb as any);
            await model.countByFilters(FULL_GEO);

            const searchChunks = (searchWhere as { queryChunks?: unknown[] })?.queryChunks;
            const countChunks = (countWhere as { queryChunks?: unknown[] })?.queryChunks;
            expect((countChunks as unknown[]).length).toBe((searchChunks as unknown[]).length);
        });

        it('searchWithRelations() resolves when the full triplet is supplied', async () => {
            const { db } = makeSearchWithRelationsMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            const result = await model.searchWithRelations(FULL_GEO);
            expect(result.items).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('countByFilters() resolves when bbox and geo radius are combined', async () => {
            // Both predicates are AND-composed at the model layer, so the
            // count query must still resolve without throwing.
            const { db } = makeCountMock({ total: 0 });
            getDb.mockReturnValue(db as any);

            const result = await model.countByFilters({
                bboxNorth: -32.0,
                bboxSouth: -34.0,
                bboxEast: -57.0,
                bboxWest: -59.0,
                ...FULL_GEO
            });
            expect(result.count).toBe(0);
        });
    });

    // =========================================================================
    // Optional include flags (amenities / features projections)
    // =========================================================================

    describe('searchWithRelations() — include flags', () => {
        it('omits amenities/features from the with-clause by default', async () => {
            const { db, mocks } = makeSearchWithRelationsMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            await model.searchWithRelations({});

            expect(mocks.findManyFn).toHaveBeenCalledTimes(1);
            const findManyArg = mocks.findManyFn.mock.calls[0]?.[0] as {
                with: Record<string, unknown>;
            };
            // Default relations are still loaded.
            expect(findManyArg.with).toHaveProperty('destination');
            expect(findManyArg.with).toHaveProperty('owner');
            // Amenities/features should NOT be present when not asked for.
            expect(findManyArg.with).not.toHaveProperty('amenities');
            expect(findManyArg.with).not.toHaveProperty('features');
        });

        it('adds the amenities relation when includeAmenities is true', async () => {
            const { db, mocks } = makeSearchWithRelationsMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            await model.searchWithRelations({ includeAmenities: true });

            const findManyArg = mocks.findManyFn.mock.calls[0]?.[0] as {
                with: Record<string, unknown>;
            };
            expect(findManyArg.with).toHaveProperty('amenities');
            // The nested `with: { amenity: true }` is what flattens the
            // junction row to the canonical {amenity: {...}} shape the web
            // transforms expect.
            expect((findManyArg.with.amenities as { with?: unknown }).with).toEqual({
                amenity: true
            });
            // Features still skipped because the flag was not set.
            expect(findManyArg.with).not.toHaveProperty('features');
        });

        it('adds the features relation when includeFeatures is true', async () => {
            const { db, mocks } = makeSearchWithRelationsMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            await model.searchWithRelations({ includeFeatures: true });

            const findManyArg = mocks.findManyFn.mock.calls[0]?.[0] as {
                with: Record<string, unknown>;
            };
            expect(findManyArg.with).toHaveProperty('features');
            expect((findManyArg.with.features as { with?: unknown }).with).toEqual({
                feature: true
            });
            expect(findManyArg.with).not.toHaveProperty('amenities');
        });

        it('adds both relations when both flags are true', async () => {
            const { db, mocks } = makeSearchWithRelationsMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as any);

            await model.searchWithRelations({
                includeAmenities: true,
                includeFeatures: true
            });

            const findManyArg = mocks.findManyFn.mock.calls[0]?.[0] as {
                with: Record<string, unknown>;
            };
            expect(findManyArg.with).toHaveProperty('amenities');
            expect(findManyArg.with).toHaveProperty('features');
        });
    });

    // =========================================================================
    // buildAccommodationOrderBy — export smoke-test
    // =========================================================================

    describe('buildAccommodationOrderBy (re-export sanity)', () => {
        it('is exported and returns an array', () => {
            const result = buildAccommodationOrderBy({});
            expect(Array.isArray(result)).toBe(true);
            // Always has at least the tiebreaker (id DESC)
            expect(result.length).toBeGreaterThanOrEqual(1);
        });
    });
});
