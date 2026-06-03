import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AppLogEntryModel } from '../../src/models/app-log/appLogEntry.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AppLogEntryModel', () => {
    let model: AppLogEntryModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AppLogEntryModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return the correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('app_log_entries');
        });
    });

    describe('listEntries', () => {
        it('should delegate equality filters, pagination, and date range to findAll', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });
            const fromDate = new Date('2026-06-01T00:00:00Z');
            const toDate = new Date('2026-06-03T00:00:00Z');

            // Act
            await model.listEntries({
                level: 'ERROR',
                category: 'API',
                fromDate,
                toDate,
                page: 2,
                pageSize: 25
            });

            // Assert
            expect(findAll).toHaveBeenCalledOnce();
            const [where, options, conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toEqual({ level: 'ERROR', category: 'API' });
            expect(options).toEqual({
                page: 2,
                pageSize: 25,
                sortBy: 'loggedAt',
                sortOrder: 'desc'
            });
            expect(conditions).toHaveLength(2);
        });

        it('should pass no conditions when no date range is given', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            // Act
            await model.listEntries({});

            // Assert
            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toEqual({});
            expect(conditions).toBeUndefined();
        });
    });

    describe('purgeOlderThan', () => {
        it('should hard-delete entries older than the threshold and return the count', async () => {
            // Arrange
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({
                        returning: () => Promise.resolve([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
                    })
                })
            });

            // Act
            const deleted = await model.purgeOlderThan({ before: new Date('2026-05-01') });

            // Assert
            expect(deleted).toBe(3);
        });

        it('should return 0 when nothing matches', async () => {
            // Arrange
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({
                        returning: () => Promise.resolve([])
                    })
                })
            });

            // Act
            const deleted = await model.purgeOlderThan({ before: new Date('2026-05-01') });

            // Assert
            expect(deleted).toBe(0);
        });
    });
});
