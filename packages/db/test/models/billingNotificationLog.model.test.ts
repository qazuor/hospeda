import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { BillingNotificationLogModel } from '../../src/models/billing/billingNotificationLog.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('BillingNotificationLogModel', () => {
    let model: BillingNotificationLogModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new BillingNotificationLogModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('billing_notification_log');
        });
    });

    describe('findAll', () => {
        it('should return items array and total', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                return Promise.resolve([{ count: '3' }]);
                            }
                            const qb = {
                                limit: () => ({
                                    offset: () =>
                                        Promise.resolve([
                                            { id: 'n1', customerId: 'c1', type: 'payment_failed' },
                                            { id: 'n2', customerId: 'c1', type: 'trial_ending' },
                                            { id: 'n3', customerId: 'c2', type: 'payment_failed' }
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

            expect(result.items).toHaveLength(3);
            expect(result.total).toBe(3);
            expect(logQuery).toHaveBeenCalled();
        });

        it('should return empty array when no records', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                return Promise.resolve([{ count: '0' }]);
                            }
                            const qb = {
                                limit: () => ({ offset: () => Promise.resolve([]) }),
                                $dynamic: () => qb
                            };
                            return qb;
                        }
                    })
                })
            });

            const result = await model.findAll({});

            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });
    });

    describe('findById', () => {
        it('should return record when found', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [{ id: 'n1', customerId: 'c1', type: 'payment_failed' }]
                        })
                    })
                })
            });

            const result = await model.findById('n1');

            expect(result).toEqual({ id: 'n1', customerId: 'c1', type: 'payment_failed' });
            expect(logQuery).toHaveBeenCalled();
        });

        it('should return null when record not found', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({ where: () => ({ limit: () => [] }) })
                })
            });

            const result = await model.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('hardDelete', () => {
        it('should hard-delete a log record and return count', async () => {
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({ returning: () => [{ id: 'n1' }] })
                })
            });

            const result = await model.hardDelete({ id: 'n1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });
});
