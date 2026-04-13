/**
 * Unit tests for RevalidationLogModel custom methods.
 *
 * Tests the model-specific query helpers:
 *   - deleteOlderThan(date): removes rows older than the given cutoff date
 *   - findLastCronEntry(entityType): returns the most recent cron-triggered row
 *     for the given entity type, filtered by trigger='cron'
 *
 * @module test/models/revalidation-log.model.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RevalidationLogModel } from '../../src/models/revalidation/revalidation-log.model';
import type { DrizzleClient } from '../../src/types';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

/** Sample log rows used across tests */
const cronLogRecent = {
    id: 'log-uuid-0001-0000-0000-000000000001',
    path: '/en/accommodations',
    entityType: 'accommodation',
    entityId: null,
    trigger: 'cron',
    triggeredBy: 'system',
    status: 'success',
    durationMs: 80,
    errorMessage: null,
    metadata: null,
    createdAt: new Date('2025-06-10T12:00:00Z')
};

const cronLogOld = {
    id: 'log-uuid-0002-0000-0000-000000000002',
    path: '/en/accommodations',
    entityType: 'accommodation',
    entityId: null,
    trigger: 'cron',
    triggeredBy: 'system',
    status: 'success',
    durationMs: 95,
    errorMessage: null,
    metadata: null,
    createdAt: new Date('2025-01-01T00:00:00Z')
};

const _manualLog = {
    id: 'log-uuid-0003-0000-0000-000000000003',
    path: '/en/accommodations/hotel-abc',
    entityType: 'accommodation',
    entityId: 'acc-001',
    trigger: 'manual',
    triggeredBy: 'user-abc',
    status: 'success',
    durationMs: 120,
    errorMessage: null,
    metadata: null,
    createdAt: new Date('2025-06-15T08:00:00Z')
};

describe('RevalidationLogModel', () => {
    let model: RevalidationLogModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new RevalidationLogModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // deleteOlderThan
    // =========================================================================

    describe('deleteOlderThan', () => {
        it('returns the count of deleted rows', async () => {
            // Arrange
            const mockDelete = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockReturning = vi
                .fn()
                .mockResolvedValue([{ id: cronLogOld.id }, { id: 'log-uuid-extra-row' }]);

            getDb.mockReturnValue({
                delete: mockDelete,
                where: mockWhere,
                returning: mockReturning
            });

            mockDelete.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ returning: mockReturning });

            const cutoff = new Date('2025-03-01T00:00:00Z');

            // Act
            const count = await model.deleteOlderThan(cutoff);

            // Assert
            expect(count).toBe(2);
        });

        it('does not delete rows newer than the cutoff date', async () => {
            // Arrange — DB returns 0 rows deleted (cutoff is in the past, recent rows survive)
            const mockDelete = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockReturning = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({
                delete: mockDelete,
                where: mockWhere,
                returning: mockReturning
            });

            mockDelete.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ returning: mockReturning });

            // Act: cutoff is old enough that no rows are before it
            const cutoff = new Date('2020-01-01T00:00:00Z');
            const count = await model.deleteOlderThan(cutoff);

            // Assert
            expect(count).toBe(0);
        });

        it('returns 0 when the log is empty', async () => {
            // Arrange
            const mockDelete = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockReturning = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({
                delete: mockDelete,
                where: mockWhere,
                returning: mockReturning
            });

            mockDelete.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ returning: mockReturning });

            // Act
            const count = await model.deleteOlderThan(new Date());

            // Assert
            expect(count).toBe(0);
        });

        it('uses provided tx instead of getDb when tx is supplied', async () => {
            // Arrange
            const mockDelete = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockReturning = vi.fn().mockResolvedValue([{ id: cronLogOld.id }]);

            const txMock = {
                delete: mockDelete,
                where: mockWhere,
                returning: mockReturning
            };
            mockDelete.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ returning: mockReturning });

            const cutoff = new Date('2025-03-01T00:00:00Z');

            // Act
            const result = await model.deleteOlderThan(cutoff, txMock as unknown as DrizzleClient);

            // Assert — tx.delete was called, getDb was NOT called
            expect(result).toBe(1);
            expect(mockDelete).toHaveBeenCalled();
            expect(getDb).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // findWithFilters
    // =========================================================================

    describe('findWithFilters', () => {
        /**
         * Helper to create a mock db object for findWithFilters.
         * The method calls getDb() once and uses the same db instance for
         * both the items query and the count query via Promise.all.
         * We use select() call count to distinguish between the two chains.
         */
        function createFindWithFiltersMock(items: unknown[], total: number) {
            // Items chain ends: select().from().where().orderBy().limit().offset()
            const mockOffset = vi.fn().mockResolvedValue(items);
            const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
            const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });

            // Count chain ends: select({count}).from().where()
            const mockCountWhere = vi.fn().mockResolvedValue([{ count: total }]);
            const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

            // Items chain where -> orderBy
            const mockItemsWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            const mockItemsFrom = vi.fn().mockReturnValue({ where: mockItemsWhere });

            let selectCallCount = 0;
            const mockSelect = vi.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return { from: mockItemsFrom };
                }
                return { from: mockCountFrom };
            });

            getDb.mockReturnValue({ select: mockSelect });

            return { mockSelect, mockItemsWhere, mockLimit, mockOffset };
        }

        it('returns paginated items and total count with no filters', async () => {
            // Arrange
            createFindWithFiltersMock([cronLogRecent, cronLogOld], 2);

            // Act
            const result = await model.findWithFilters({});

            // Assert
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('applies path filter parameter', async () => {
            // Arrange
            const { mockItemsWhere } = createFindWithFiltersMock([cronLogRecent], 1);

            // Act
            const result = await model.findWithFilters({ path: '/en/accommodations' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(mockItemsWhere).toHaveBeenCalled();
        });

        it('applies date range filters', async () => {
            // Arrange
            const { mockItemsWhere } = createFindWithFiltersMock([], 0);

            // Act
            const result = await model.findWithFilters({
                fromDate: new Date('2025-01-01'),
                toDate: new Date('2025-06-30')
            });

            // Assert
            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
            expect(mockItemsWhere).toHaveBeenCalled();
        });

        it('respects pagination options', async () => {
            // Arrange
            const { mockLimit, mockOffset } = createFindWithFiltersMock([], 50);

            // Act
            const result = await model.findWithFilters({}, { page: 3, pageSize: 10 });

            // Assert
            expect(result.total).toBe(50);
            expect(mockLimit).toHaveBeenCalledWith(10);
            expect(mockOffset).toHaveBeenCalledWith(20);
        });
    });

    // =========================================================================
    // findLastCronEntry
    // =========================================================================

    describe('findLastCronEntry', () => {
        it('returns the most recent cron entry ordered by createdAt DESC', async () => {
            // Arrange — DB returns newest cron log first (ORDER BY created_at DESC LIMIT 1)
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([cronLogRecent]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ orderBy: mockOrderBy });
            mockOrderBy.mockReturnValue({ limit: mockLimit });

            // Act
            const result = await model.findLastCronEntry('accommodation');

            // Assert — receives the most recent record
            expect(result).toEqual(cronLogRecent);
            expect(result?.trigger).toBe('cron');
        });

        it('does not return entries with trigger="manual"', async () => {
            // Arrange — DB returns no results because WHERE includes trigger='cron'
            // and the only existing entry for this entity has trigger='manual'
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ orderBy: mockOrderBy });
            mockOrderBy.mockReturnValue({ limit: mockLimit });

            // Act — manualLog has trigger='manual', so the DB WHERE trigger='cron' excludes it
            const result = await model.findLastCronEntry('accommodation');

            // Assert
            expect(result).toBeUndefined();
        });

        it('returns undefined when no cron entries exist for the entity type', async () => {
            // Arrange
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ orderBy: mockOrderBy });
            mockOrderBy.mockReturnValue({ limit: mockLimit });

            // Act
            const result = await model.findLastCronEntry('event');

            // Assert
            expect(result).toBeUndefined();
        });

        it('returns the newest cron entry when multiple exist', async () => {
            // Arrange — DB returns only the most recent (ORDER BY + LIMIT 1 enforced at DB level)
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([cronLogRecent]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ orderBy: mockOrderBy });
            mockOrderBy.mockReturnValue({ limit: mockLimit });

            // Act
            const result = await model.findLastCronEntry('accommodation');

            // Assert — the most recent cron entry is returned, not the old one
            expect(result?.id).toBe(cronLogRecent.id);
            expect(result?.createdAt.getTime()).toBeGreaterThan(cronLogOld.createdAt.getTime());
        });
    });
});
