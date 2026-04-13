import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { BillingSubscriptionEventModel } from '../../src/models/billing/billingSubscriptionEvent.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('BillingSubscriptionEventModel', () => {
    let model: BillingSubscriptionEventModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new BillingSubscriptionEventModel();
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
            expect(tableName).toBe('billing_subscription_events');
        });
    });

    describe('findAll', () => {
        it('should return items array and total', async () => {
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
                                            {
                                                id: 'e1',
                                                subscriptionId: 'sub1',
                                                eventType: 'activated'
                                            },
                                            {
                                                id: 'e2',
                                                subscriptionId: 'sub1',
                                                eventType: 'cancelled'
                                            }
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

            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
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
                            limit: () => [
                                { id: 'e1', subscriptionId: 'sub1', eventType: 'activated' }
                            ]
                        })
                    })
                })
            });

            const result = await model.findById('e1');

            expect(result).toEqual({ id: 'e1', subscriptionId: 'sub1', eventType: 'activated' });
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
        it('should hard-delete an event record and return count', async () => {
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({ returning: () => [{ id: 'e1' }] })
                })
            });

            const result = await model.hardDelete({ id: 'e1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });
});
