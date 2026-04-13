import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { BillingAddonPurchaseModel } from '../../src/models/billing/billingAddonPurchase.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('BillingAddonPurchaseModel', () => {
    let model: BillingAddonPurchaseModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new BillingAddonPurchaseModel();
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
            expect(tableName).toBe('billing_addon_purchases');
        });
    });

    describe('findAll', () => {
        it('should return items array and total', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                return Promise.resolve([{ count: '1' }]);
                            }
                            const qb = {
                                limit: () => ({
                                    offset: () =>
                                        Promise.resolve([
                                            { id: 'p1', customerId: 'c1', status: 'active' }
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

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
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
                            limit: () => [{ id: 'p1', customerId: 'c1', status: 'active' }]
                        })
                    })
                })
            });

            const result = await model.findById('p1');

            expect(result).toEqual({ id: 'p1', customerId: 'c1', status: 'active' });
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

    describe('softDelete', () => {
        it('should soft-delete a record and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'p1' }] })
                    })
                })
            });

            const result = await model.softDelete({ id: 'p1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });
});
