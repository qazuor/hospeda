import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { BillingSettingsModel } from '../../src/models/billing/billingSettings.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('BillingSettingsModel', () => {
    let model: BillingSettingsModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new BillingSettingsModel();
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
            expect(tableName).toBe('billing_settings');
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
                                            { id: 'gs1', key: 'global', value: { taxRate: 21 } }
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
            const settingsRow = { id: 'gs1', key: 'global', value: { taxRate: 21 } };
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({ limit: () => [settingsRow] })
                    })
                })
            });

            const result = await model.findById('gs1');

            expect(result).toEqual(settingsRow);
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

    describe('update', () => {
        it('should update a settings record and return updated row', async () => {
            const updated = { id: 'gs1', key: 'global', value: { taxRate: 22 } };
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [updated] })
                    })
                })
            });

            const result = await model.update({ id: 'gs1' }, { value: { taxRate: 22 } });

            expect(result).toEqual(updated);
            expect(logQuery).toHaveBeenCalled();
        });
    });
});
