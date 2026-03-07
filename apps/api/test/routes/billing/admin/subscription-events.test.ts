/**
 * Unit Tests for listSubscriptionEventsHandler
 *
 * Tests for the extracted handler function that returns paginated
 * subscription lifecycle events for admin dashboard display.
 *
 * The global test setup (test/setup.ts) provides the @repo/db mock via
 * createDbMock(). This file reconfigures getDb() per test to control
 * what the handler sees without leaking state between tests.
 *
 * @module test/routes/billing/admin/subscription-events
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Partial mock of the env module: keep all real exports but override the `env`
// object so module-scope code in response-validator and cors middleware does not
// crash when createAdminRoute is imported in this test.
vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            NODE_ENV: 'test'
        },
        validateApiEnv: vi.fn()
    };
});

// Import after global mocks provided by setup.ts
import { getDb } from '@repo/db';
import type { Context } from 'hono';
import { listSubscriptionEventsHandler } from '../../../../src/routes/billing/admin/subscription-events';

/**
 * Minimal Hono context stub - the handler only reads AppBindings via
 * getDb() (module-level), so the context itself is unused by the handler logic.
 */
function createMockContext(): Context {
    return {} as unknown as Context;
}

/**
 * Configures the mocked getDb() to return a db object where:
 * - First select() call returns the events query chain
 * - Second select() call returns the count query chain
 *
 * The handler calls both via Promise.all so call order is deterministic.
 */
function buildMockDb({
    events = [] as unknown[],
    countValue = 0
}: {
    events?: unknown[];
    countValue?: number;
}) {
    // Count query chain: select().from().where() -> [{ count: N }]
    const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: countValue }])
    };

    // Events query chain: select().from().where().orderBy().limit().offset() -> rows
    const eventsChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(events)
    };

    let callCount = 0;
    const mockSelect = vi.fn(() => {
        callCount += 1;
        // Handler calls select() twice inside Promise.all:
        // 1st call = events query, 2nd call = count query
        return callCount === 1 ? eventsChain : countChain;
    });

    vi.mocked(getDb).mockReturnValue({ select: mockSelect } as ReturnType<typeof getDb>);

    return { mockSelect, eventsChain, countChain };
}

/**
 * Factory for a realistic billing_subscription_event DB row as returned by Drizzle.
 */
function makeEventRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'evt-001',
        subscriptionId: 'sub-abc-123',
        previousStatus: 'active',
        newStatus: 'cancelled',
        triggerSource: 'webhook',
        providerEventId: 'mp-event-999',
        metadata: { reason: 'user_request' },
        createdAt: new Date('2025-06-01T10:00:00Z'),
        ...overrides
    };
}

// ---------------------------------------------------------------------------

describe('listSubscriptionEventsHandler', () => {
    const ctx = createMockContext();
    const subscriptionId = 'sub-abc-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------

    describe('returns paginated events', () => {
        it('should return events array and pagination when events exist', async () => {
            // Arrange
            const row = makeEventRow();
            buildMockDb({ events: [row], countValue: 1 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 1, pageSize: 10 }
            );

            // Assert
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('evt-001');
            expect(result.data[0].subscriptionId).toBe(subscriptionId);
            expect(result.pagination.totalItems).toBe(1);
        });

        it('should map all event fields to the expected response shape', async () => {
            // Arrange
            const row = makeEventRow({
                id: 'evt-shape-test',
                previousStatus: 'paused',
                newStatus: 'active',
                triggerSource: 'admin',
                providerEventId: 'mp-777',
                metadata: { note: 'reactivation' }
            });
            buildMockDb({ events: [row], countValue: 1 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 1, pageSize: 10 }
            );

            // Assert - every expected field is present
            const evt = result.data[0];
            expect(evt).toHaveProperty('id', 'evt-shape-test');
            expect(evt).toHaveProperty('subscriptionId', subscriptionId);
            expect(evt).toHaveProperty('previousStatus', 'paused');
            expect(evt).toHaveProperty('newStatus', 'active');
            expect(evt).toHaveProperty('triggerSource', 'admin');
            expect(evt).toHaveProperty('providerEventId', 'mp-777');
            expect(evt).toHaveProperty('metadata');
            // createdAt must be serialized as ISO string, not a Date object
            expect(typeof evt.createdAt).toBe('string');
            expect(evt.createdAt).toBe(row.createdAt.toISOString());
        });
    });

    // -------------------------------------------------------------------------

    describe('default pagination', () => {
        it('should use page=1 and pageSize=10 when query param is omitted', async () => {
            // Arrange
            buildMockDb({ events: [], countValue: 0 });

            // Act - no query argument
            const result = await listSubscriptionEventsHandler(ctx, { id: subscriptionId }, {});

            // Assert
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.pageSize).toBe(10);
        });

        it('should use page=1 and pageSize=10 when query is explicitly undefined', async () => {
            // Arrange
            buildMockDb({ events: [], countValue: 0 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                undefined
            );

            // Assert
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.pageSize).toBe(10);
        });
    });

    // -------------------------------------------------------------------------

    describe('custom pagination', () => {
        it('should reflect custom page and pageSize in the pagination response', async () => {
            // Arrange - 5 rows on page 3 of a 25-item set
            const rows = Array.from({ length: 5 }, (_, i) => makeEventRow({ id: `evt-${i}` }));
            buildMockDb({ events: rows, countValue: 25 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 3, pageSize: 5 }
            );

            // Assert
            expect(result.pagination.page).toBe(3);
            expect(result.pagination.pageSize).toBe(5);
            expect(result.data).toHaveLength(5);
        });

        it('should compute totalPages correctly for given pageSize', async () => {
            // Arrange - 25 items, pageSize 5 -> 5 pages
            buildMockDb({ events: [], countValue: 25 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 1, pageSize: 5 }
            );

            // Assert
            expect(result.pagination.totalItems).toBe(25);
            expect(result.pagination.totalPages).toBe(5);
        });
    });

    // -------------------------------------------------------------------------

    describe('empty results', () => {
        it('should return empty data array and zero counts for a subscription with no events', async () => {
            // Arrange
            buildMockDb({ events: [], countValue: 0 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: 'sub-does-not-exist' },
                {},
                { page: 1, pageSize: 10 }
            );

            // Assert
            expect(result.data).toEqual([]);
            expect(result.pagination.totalItems).toBe(0);
            expect(result.pagination.totalPages).toBe(0);
        });
    });

    // -------------------------------------------------------------------------

    describe('ordering by createdAt DESC', () => {
        it('should call orderBy exactly once on the events query chain', async () => {
            // Arrange
            const { eventsChain } = buildMockDb({ events: [], countValue: 0 });

            // Act
            await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 1, pageSize: 10 }
            );

            // Assert - handler must apply DESC ordering via orderBy()
            // We verify orderBy() was called (the handler passes desc(createdAt) to it).
            // The exact argument shape is an internal Drizzle SQL object, so we only
            // check the call count and that a truthy argument was provided.
            expect(eventsChain.orderBy).toHaveBeenCalledTimes(1);
            const [orderArg] = eventsChain.orderBy.mock.calls[0];
            expect(orderArg).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------

    describe('response shape', () => {
        it('should always include both a data array and a pagination object', async () => {
            // Arrange
            buildMockDb({ events: [], countValue: 0 });

            // Act
            const result = await listSubscriptionEventsHandler(ctx, { id: subscriptionId }, {});

            // Assert - top-level structure
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('pagination');
            expect(Array.isArray(result.data)).toBe(true);

            // Assert - pagination keys
            expect(result.pagination).toHaveProperty('page');
            expect(result.pagination).toHaveProperty('pageSize');
            expect(result.pagination).toHaveProperty('totalItems');
            expect(result.pagination).toHaveProperty('totalPages');
        });

        it('should set providerEventId to null when the DB row value is null', async () => {
            // Arrange
            const row = makeEventRow({ providerEventId: null });
            buildMockDb({ events: [row], countValue: 1 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 1, pageSize: 10 }
            );

            // Assert
            expect(result.data[0].providerEventId).toBeNull();
        });

        it('should set metadata to empty object when the DB row metadata is null', async () => {
            // Arrange
            const row = makeEventRow({ metadata: null });
            buildMockDb({ events: [row], countValue: 1 });

            // Act
            const result = await listSubscriptionEventsHandler(
                ctx,
                { id: subscriptionId },
                {},
                { page: 1, pageSize: 10 }
            );

            // Assert
            expect(result.data[0].metadata).toEqual({});
        });
    });

    // -------------------------------------------------------------------------

    describe('error handling', () => {
        it('should throw HTTPException(500) when the DB query rejects', async () => {
            // Arrange - events query offset() rejects
            const countChain = {
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue([{ count: 0 }])
            };
            const eventsChain = {
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                offset: vi.fn().mockRejectedValue(new Error('DB connection lost'))
            };

            let callCount = 0;
            vi.mocked(getDb).mockReturnValue({
                select: vi.fn(() => {
                    callCount += 1;
                    return callCount === 1 ? eventsChain : countChain;
                })
            } as ReturnType<typeof getDb>);

            // Act & Assert
            await expect(
                listSubscriptionEventsHandler(
                    ctx,
                    { id: subscriptionId },
                    {},
                    { page: 1, pageSize: 10 }
                )
            ).rejects.toThrow('Failed to retrieve subscription events');
        });
    });
});
