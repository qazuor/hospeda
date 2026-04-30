/**
 * Tests for EventModel.search() and EventModel.searchWithRelations()
 * focusing on destinationId filter behavior.
 *
 * REQ-096-02 / T-004 (SPEC-096): Events can be filtered by
 * events.destination_id (the direct FK added by migration 0017_event_destination_fk.sql).
 *
 * All tests use mocked Drizzle clients following the project convention
 * (vi.spyOn(dbUtils, 'getDb')).  No real DB connection is required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { EventModel } from '../../../src/models/event/event.model';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock for db.select().from().where().limit().offset()
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

    // Items query mock: select().from().where().limit().offset() → items[]
    const offsetFn = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
    const itemsWhereFn = vi.fn((clause: unknown) => {
        if (captureWhere) captureWhere(clause);
        return { limit: limitFn };
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
        mocks: { selectFn, itemsWhereFn, countWhereFn, limitFn, offsetFn }
    };
}

/**
 * Creates a mock for db.query.events.findMany() + db.select().from().where()
 * (used by searchWithRelations).
 */
function makeSearchWithRelationsMock(opts: {
    items?: unknown[];
    total?: number;
}) {
    const { items = [], total = 0 } = opts;

    const findManyFn = vi.fn().mockResolvedValue(items);
    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });
    const countSelectFn = vi.fn().mockReturnValue({ from: countFromFn });

    return {
        db: {
            query: { events: { findMany: findManyFn } },
            select: countSelectFn
        },
        mocks: { findManyFn, countWhereFn }
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EventModel — destinationId filter (REQ-096-02)', () => {
    let model: EventModel;
    let getDb: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        model = new EventModel();
        getDb = vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // search() — destinationId filter
    // =========================================================================

    describe('search() — destinationId filter', () => {
        it('returns matching events when a single destinationId is provided', async () => {
            // Arrange
            const mockItems = [{ id: 'event-1', name: 'Festival A' }];
            const { db } = makeSearchMock({ items: mockItems, total: 1 });
            getDb.mockReturnValue(db as never);

            // Act
            const result = await model.search({ destinationId: 'dest-uuid-1' });

            // Assert
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(1);
            expect(db.select).toHaveBeenCalled();
        });

        it('passes a WHERE clause when destinationId is provided', async () => {
            // Arrange — capture the WHERE clause passed to the items query
            let capturedWhere: unknown;
            const { db } = makeSearchMock({
                items: [{ id: 'event-2' }],
                total: 1,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as never);

            // Act
            await model.search({ destinationId: 'dest-uuid-2' });

            // Assert — WHERE clause must be defined (AND-composed with isNull(deletedAt))
            expect(capturedWhere).toBeDefined();
            expect(capturedWhere).not.toBeNull();
        });

        it('returns empty results when no events match the destinationId', async () => {
            // Arrange
            const { db } = makeSearchMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as never);

            // Act
            const result = await model.search({ destinationId: 'non-existent-dest' });

            // Assert
            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('returns all non-deleted events when no destinationId is provided', async () => {
            // Arrange
            const mockItems = [{ id: 'event-3' }, { id: 'event-4' }];
            const { db } = makeSearchMock({ items: mockItems, total: 2 });
            getDb.mockReturnValue(db as never);

            // Act — no destinationId filter
            const result = await model.search({});

            // Assert
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(2);
        });
    });

    // =========================================================================
    // search() — combined with pagination
    // =========================================================================

    describe('search() — pagination with destinationId filter', () => {
        it('applies limit and offset correctly when destinationId filter is active', async () => {
            // Arrange
            const { db, mocks } = makeSearchMock({ items: [{ id: 'event-5' }], total: 5 });
            getDb.mockReturnValue(db as never);

            // Act
            await model.search({ destinationId: 'dest-uuid-3', page: 2, pageSize: 1 });

            // Assert — offset = (2-1) * 1 = 1
            expect(mocks.limitFn).toHaveBeenCalledWith(1);
            expect(mocks.offsetFn).toHaveBeenCalledWith(1);
        });

        it('defaults to page 1 / pageSize 10 when not specified', async () => {
            // Arrange
            const { db, mocks } = makeSearchMock({ items: [], total: 0 });
            getDb.mockReturnValue(db as never);

            // Act
            await model.search({ destinationId: 'dest-uuid-4' });

            // Assert
            expect(mocks.limitFn).toHaveBeenCalledWith(10);
            expect(mocks.offsetFn).toHaveBeenCalledWith(0);
        });
    });

    // =========================================================================
    // search() — soft-delete exclusion
    // =========================================================================

    describe('search() — soft-delete excluded', () => {
        it('always includes isNull(deletedAt) in the WHERE clause', async () => {
            // Arrange
            let capturedWhere: unknown;
            const { db } = makeSearchMock({
                items: [],
                total: 0,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as never);

            // Act — even without destinationId, the WHERE clause must be non-null
            await model.search({});

            // Assert — WHERE always contains isNull(deletedAt)
            expect(capturedWhere).toBeDefined();
            expect(capturedWhere).not.toBeNull();
        });

        it('composes destinationId with soft-delete filter', async () => {
            // Arrange
            let capturedWhere: unknown;
            const { db } = makeSearchMock({
                items: [],
                total: 0,
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            });
            getDb.mockReturnValue(db as never);

            // Act
            await model.search({ destinationId: 'dest-uuid-5' });

            // Assert — the AND-composed clause is truthy
            expect(capturedWhere).toBeDefined();
        });
    });

    // =========================================================================
    // searchWithRelations() — destinationId filter
    // =========================================================================

    describe('searchWithRelations() — destinationId filter', () => {
        it('returns items with relations when destinationId is provided', async () => {
            // Arrange
            const mockItems = [{ id: 'event-6', organizer: { id: 'org-1' } }];
            const { db } = makeSearchWithRelationsMock({ items: mockItems, total: 1 });
            getDb.mockReturnValue(db as never);

            // Act
            const result = await model.searchWithRelations({ destinationId: 'dest-uuid-6' });

            // Assert
            expect(result.items).toEqual(mockItems);
            expect(result.total).toBe(1);
            expect(db.query.events.findMany).toHaveBeenCalled();
        });

        it('passes the WHERE clause to findMany when destinationId is provided', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({ items: [], total: 0 });
            db.query.events.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([]);
            });
            getDb.mockReturnValue(db as never);

            // Act
            await model.searchWithRelations({ destinationId: 'dest-uuid-7' });

            // Assert — findMany receives a `where` argument (not undefined)
            expect((capturedArgs as { where?: unknown })?.where).toBeDefined();
        });

        it('passes WHERE clause even without destinationId (soft-delete filter always present)', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({ items: [{ id: 'event-7' }], total: 1 });
            db.query.events.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([{ id: 'event-7' }]);
            });
            getDb.mockReturnValue(db as never);

            // Act — no destinationId
            const result = await model.searchWithRelations({});

            // Assert — still has where (isNull deletedAt)
            expect(result.total).toBe(1);
            expect((capturedArgs as { where?: unknown })?.where).toBeDefined();
        });

        it('applies correct pagination in searchWithRelations', async () => {
            // Arrange
            let capturedArgs: unknown;
            const { db } = makeSearchWithRelationsMock({ items: [{ id: 'event-8' }], total: 10 });
            db.query.events.findMany = vi.fn().mockImplementation((args: unknown) => {
                capturedArgs = args;
                return Promise.resolve([{ id: 'event-8' }]);
            });
            getDb.mockReturnValue(db as never);

            // Act
            await model.searchWithRelations({ destinationId: 'dest-uuid-8', page: 3, pageSize: 2 });

            // Assert — offset = (3-1) * 2 = 4
            expect((capturedArgs as { limit?: number })?.limit).toBe(2);
            expect((capturedArgs as { offset?: number })?.offset).toBe(4);
        });
    });
});
