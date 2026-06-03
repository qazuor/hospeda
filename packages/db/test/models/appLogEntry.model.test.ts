import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AppLogEntryModel } from '../../src/models/app-log/appLogEntry.model';
import * as logger from '../../src/utils/logger';

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

        it('should include requestId in the equality where clause', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            // Act
            await model.listEntries({ requestId: 'req-abc-123' });

            // Assert
            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toMatchObject({ requestId: 'req-abc-123' });
            expect(conditions).toBeUndefined();
        });

        it('should include userId in the equality where clause', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });
            const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            // Act
            await model.listEntries({ userId });

            // Assert
            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toMatchObject({ userId });
            expect(conditions).toBeUndefined();
        });

        it('should include method in the equality where clause', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            // Act
            await model.listEntries({ method: 'POST' });

            // Assert
            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toMatchObject({ method: 'POST' });
            expect(conditions).toBeUndefined();
        });

        it('should add a safeIlike SQL condition for path substring match', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            // Act
            await model.listEntries({ path: '/api/v1/public' });

            // Assert
            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            // path is a contains-search, not an equality filter — it must NOT appear in where
            expect(where).not.toHaveProperty('path');
            // It must produce exactly one SQL condition (the ilike clause)
            expect(conditions).toHaveLength(1);
        });

        it('should combine all new request-context filters with existing filters', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });
            const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
            const fromDate = new Date('2026-06-01T00:00:00Z');

            // Act
            await model.listEntries({
                level: 'ERROR',
                category: 'BILLING',
                requestId: 'req-combo',
                userId,
                method: 'GET',
                path: '/api',
                fromDate
            });

            // Assert
            expect(findAll).toHaveBeenCalledOnce();
            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            // Equality filters go into where
            expect(where).toMatchObject({
                level: 'ERROR',
                category: 'BILLING',
                requestId: 'req-combo',
                userId,
                method: 'GET'
            });
            expect(where).not.toHaveProperty('path');
            // path ilike + fromDate gte = 2 conditions
            expect(conditions).toHaveLength(2);
        });

        it('should not add requestId/userId/method to where when they are absent', async () => {
            // Arrange
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            // Act
            await model.listEntries({ level: 'WARN' });

            // Assert
            const [where] = findAll.mock.calls[0] ?? [];
            expect(where).not.toHaveProperty('requestId');
            expect(where).not.toHaveProperty('userId');
            expect(where).not.toHaveProperty('method');
        });
    });

    describe('createQuiet (feedback-loop guard)', () => {
        it('should insert and return the row WITHOUT emitting any DB-layer log', async () => {
            // Arrange
            const row = { id: 'log-1', level: 'ERROR', message: 'boom' };
            getDb.mockReturnValue({
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.resolve([row])
                    })
                })
            });

            // Act
            const created = await model.createQuiet({
                level: 'ERROR',
                message: 'boom'
            } as never);

            // Assert
            expect(created).toEqual(row);
            expect(logger.logQuery).not.toHaveBeenCalled();
            expect(logger.logError).not.toHaveBeenCalled();
        });

        it('should accept and insert all 4 request-context fields', async () => {
            // Arrange
            const row = {
                id: 'log-2',
                level: 'WARN',
                message: 'slow query',
                requestId: 'req-abc123',
                userId: 'c2ddce77-7e2d-4gb0-dd8f-8dd1df502c33',
                method: 'GET',
                path: '/api/v1/public/accommodations'
            };
            getDb.mockReturnValue({
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.resolve([row])
                    })
                })
            });

            // Act
            const created = await model.createQuiet({
                level: 'WARN',
                message: 'slow query',
                requestId: 'req-abc123',
                userId: 'c2ddce77-7e2d-4gb0-dd8f-8dd1df502c33',
                method: 'GET',
                path: '/api/v1/public/accommodations'
            } as never);

            // Assert
            expect(created).toEqual(row);
            expect(created.requestId).toBe('req-abc123');
            expect(created.userId).toBe('c2ddce77-7e2d-4gb0-dd8f-8dd1df502c33');
            expect(created.method).toBe('GET');
            expect(created.path).toBe('/api/v1/public/accommodations');
            expect(logger.logQuery).not.toHaveBeenCalled();
            expect(logger.logError).not.toHaveBeenCalled();
        });

        it('should insert successfully when request-context fields are absent (non-request scope)', async () => {
            // Arrange
            const row = { id: 'log-3', level: 'ERROR', message: 'startup failure' };
            getDb.mockReturnValue({
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.resolve([row])
                    })
                })
            });

            // Act
            const created = await model.createQuiet({
                level: 'ERROR',
                message: 'startup failure'
            } as never);

            // Assert
            expect(created).toEqual(row);
            expect(created.requestId).toBeUndefined();
            expect(created.userId).toBeUndefined();
        });

        it('should propagate a driver failure WITHOUT calling logError', async () => {
            // Arrange
            getDb.mockReturnValue({
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.reject(new Error('db down'))
                    })
                })
            });

            // Act + Assert
            await expect(
                model.createQuiet({ level: 'WARN', message: 'x' } as never)
            ).rejects.toThrow('db down');
            expect(logger.logError).not.toHaveBeenCalled();
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
