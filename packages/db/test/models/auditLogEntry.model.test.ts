import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AuditLogEntryModel } from '../../src/models/audit-log/auditLogEntry.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AuditLogEntryModel', () => {
    let model: AuditLogEntryModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AuditLogEntryModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('returns the correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('audit_log_entries');
        });
    });

    describe('listEntries', () => {
        it('delegates equality filters, pagination, and date range to findAll', async () => {
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });
            const fromDate = new Date('2026-06-01T00:00:00Z');
            const toDate = new Date('2026-06-03T00:00:00Z');

            await model.listEntries({
                logType: 'audit',
                eventType: 'billing.mutation',
                severity: 'critical',
                actorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                fromDate,
                toDate,
                page: 2,
                pageSize: 25
            });

            expect(findAll).toHaveBeenCalledOnce();
            const [where, options, conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toEqual({
                logType: 'audit',
                eventType: 'billing.mutation',
                severity: 'critical',
                actorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
            });
            expect(options).toEqual({
                page: 2,
                pageSize: 25,
                sortBy: 'loggedAt',
                sortOrder: 'desc'
            });
            expect(conditions).toHaveLength(2);
        });

        it('passes no conditions when no date range is given', async () => {
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            await model.listEntries({ logType: 'security' });

            const [where, , conditions] = findAll.mock.calls[0] ?? [];
            expect(where).toEqual({ logType: 'security' });
            expect(conditions).toBeUndefined();
        });

        it('uses loggedAt desc by default (no sort input)', async () => {
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            await model.listEntries({});

            const [, options] = findAll.mock.calls[0] ?? [];
            expect(options).toMatchObject({ sortBy: 'loggedAt', sortOrder: 'desc' });
        });

        it('propagates sort severity:desc to findAll', async () => {
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            await model.listEntries({ sort: { field: 'severity', direction: 'desc' } });

            const [, options] = findAll.mock.calls[0] ?? [];
            expect(options).toMatchObject({ sortBy: 'severity', sortOrder: 'desc' });
        });

        it('propagates sort loggedAt:asc to findAll', async () => {
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            await model.listEntries({ sort: { field: 'loggedAt', direction: 'asc' } });

            const [, options] = findAll.mock.calls[0] ?? [];
            expect(options).toMatchObject({ sortBy: 'loggedAt', sortOrder: 'asc' });
        });

        it('does not add optional equality filters to where when absent', async () => {
            const findAll = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            await model.listEntries({ logType: 'audit' });

            const [where] = findAll.mock.calls[0] ?? [];
            expect(where).not.toHaveProperty('eventType');
            expect(where).not.toHaveProperty('severity');
            expect(where).not.toHaveProperty('actorId');
        });
    });

    describe('createQuiet (feedback-loop guard)', () => {
        it('inserts and returns the row WITHOUT emitting any DB-layer log', async () => {
            const row = { id: 'log-1', logType: 'audit', eventType: 'billing.mutation' };
            getDb.mockReturnValue({
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.resolve([row])
                    })
                })
            });

            const created = await model.createQuiet({
                logType: 'audit',
                eventType: 'billing.mutation',
                severity: 'critical',
                message: 'billing.mutation',
                loggedAt: new Date()
            } as never);

            expect(created).toEqual(row);
            expect(logger.logQuery).not.toHaveBeenCalled();
            expect(logger.logError).not.toHaveBeenCalled();
        });

        it('propagates a driver failure WITHOUT calling logError', async () => {
            getDb.mockReturnValue({
                insert: () => ({
                    values: () => ({
                        returning: () => Promise.reject(new Error('db down'))
                    })
                })
            });

            await expect(
                model.createQuiet({
                    logType: 'security',
                    eventType: 'auth.lockout',
                    severity: 'critical',
                    message: 'x',
                    loggedAt: new Date()
                } as never)
            ).rejects.toThrow('db down');
            expect(logger.logError).not.toHaveBeenCalled();
        });
    });

    describe('purgeOlderThan', () => {
        it('hard-deletes entries older than the threshold and returns the count', async () => {
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({
                        returning: () => Promise.resolve([{ id: 'a' }, { id: 'b' }])
                    })
                })
            });

            const deleted = await model.purgeOlderThan({ before: new Date('2026-05-01') });

            expect(deleted).toBe(2);
        });
    });
});
