import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { ExchangeRateModel } from '../../../src/models/exchange-rate/exchange-rate.model';
import * as logger from '../../../src/utils/logger';

vi.mock('../../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('ExchangeRateModel', () => {
    let model: ExchangeRateModel;
    let getDb: ReturnType<typeof vi.fn>;
    let _logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new ExchangeRateModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        _logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('exchange_rates');
        });
    });

    describe('findLatestRate', () => {
        it('should return latest rate for currency pair without rate type', async () => {
            const mockRate = {
                id: 'rate-1',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1000.5,
                inverseRate: 0.0009995,
                rateType: 'BLUE',
                source: 'BLUELYTICS',
                isManualOverride: false,
                fetchedAt: new Date('2026-02-14T10:00:00Z'),
                expiresAt: null,
                createdAt: new Date('2026-02-14T10:00:00Z'),
                updatedAt: new Date('2026-02-14T10:00:00Z')
            };

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([mockRate]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            };

            getDb.mockReturnValue(db);

            const result = await model.findLatestRate({
                fromCurrency: 'USD',
                toCurrency: 'ARS'
            });

            expect(result).toEqual(mockRate);
            expect(mockSelect).toHaveBeenCalled();
            expect(mockFrom).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalled();
            expect(mockOrderBy).toHaveBeenCalled();
            expect(mockLimit).toHaveBeenCalledWith(1);
        });

        it('should return latest rate for currency pair with rate type', async () => {
            const mockRate = {
                id: 'rate-2',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 950,
                inverseRate: 0.0010526,
                rateType: 'OFFICIAL',
                source: 'BCRA',
                isManualOverride: false,
                fetchedAt: new Date('2026-02-14T10:00:00Z'),
                expiresAt: null,
                createdAt: new Date('2026-02-14T10:00:00Z'),
                updatedAt: new Date('2026-02-14T10:00:00Z')
            };

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([mockRate]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            };

            getDb.mockReturnValue(db);

            const result = await model.findLatestRate({
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rateType: 'OFFICIAL'
            });

            expect(result).toEqual(mockRate);
            expect(mockLimit).toHaveBeenCalledWith(1);
        });

        it('should return null when no rate found', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit
            };

            getDb.mockReturnValue(db);

            const result = await model.findLatestRate({
                fromCurrency: 'EUR',
                toCurrency: 'ARS'
            });

            expect(result).toBeNull();
        });
    });

    describe('findLatestRates', () => {
        it('should return latest rates for all currency pairs', async () => {
            const mockRates = [
                {
                    exchange_rates: {
                        id: 'rate-1',
                        fromCurrency: 'USD',
                        toCurrency: 'ARS',
                        rate: 1000.5,
                        rateType: 'BLUE',
                        source: 'BLUELYTICS',
                        isManualOverride: false,
                        fetchedAt: new Date('2026-02-14T10:00:00Z')
                    }
                },
                {
                    exchange_rates: {
                        id: 'rate-2',
                        fromCurrency: 'USD',
                        toCurrency: 'ARS',
                        rate: 950,
                        rateType: 'OFFICIAL',
                        source: 'BCRA',
                        isManualOverride: false,
                        fetchedAt: new Date('2026-02-14T10:00:00Z')
                    }
                }
            ];

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockGroupBy = vi.fn().mockReturnThis();
            const mockAs = vi.fn().mockReturnThis();
            const mockInnerJoin = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue(mockRates);

            const db = {
                select: mockSelect,
                from: mockFrom,
                groupBy: mockGroupBy,
                as: mockAs,
                innerJoin: mockInnerJoin,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            const result = await model.findLatestRates();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(mockRates[0].exchange_rates);
            expect(result[1]).toEqual(mockRates[1].exchange_rates);
            expect(mockLimit).toHaveBeenCalledWith(100);
            expect(mockOffset).toHaveBeenCalledWith(0);
        });

        it('should respect limit and offset parameters', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockGroupBy = vi.fn().mockReturnThis();
            const mockAs = vi.fn().mockReturnThis();
            const mockInnerJoin = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue([]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                groupBy: mockGroupBy,
                as: mockAs,
                innerJoin: mockInnerJoin,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            await model.findLatestRates({ limit: 50, offset: 10 });

            expect(mockLimit).toHaveBeenCalledWith(50);
            expect(mockOffset).toHaveBeenCalledWith(10);
        });

        it('should return empty array when no rates found', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockGroupBy = vi.fn().mockReturnThis();
            const mockAs = vi.fn().mockReturnThis();
            const mockInnerJoin = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue([]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                groupBy: mockGroupBy,
                as: mockAs,
                innerJoin: mockInnerJoin,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            const result = await model.findLatestRates();

            expect(result).toEqual([]);
        });
    });

    describe('findRateHistory', () => {
        it('should return historical rates for currency pair without rate type', async () => {
            const mockRates = [
                {
                    id: 'rate-1',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1000.5,
                    rateType: 'BLUE',
                    fetchedAt: new Date('2026-02-14T10:00:00Z')
                },
                {
                    id: 'rate-2',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 995,
                    rateType: 'BLUE',
                    fetchedAt: new Date('2026-02-13T10:00:00Z')
                }
            ];

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue(mockRates);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            const result = await model.findRateHistory({
                fromCurrency: 'USD',
                toCurrency: 'ARS'
            });

            expect(result).toEqual(mockRates);
            expect(mockLimit).toHaveBeenCalledWith(20);
            expect(mockOffset).toHaveBeenCalledWith(0);
        });

        it('should return historical rates with rate type filter', async () => {
            const mockRates = [
                {
                    id: 'rate-1',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 950,
                    rateType: 'OFFICIAL',
                    fetchedAt: new Date('2026-02-14T10:00:00Z')
                }
            ];

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue(mockRates);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            const result = await model.findRateHistory({
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rateType: 'OFFICIAL'
            });

            expect(result).toEqual(mockRates);
        });

        it('should respect custom limit and offset', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue([]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            await model.findRateHistory({
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                limit: 50,
                offset: 10
            });

            expect(mockLimit).toHaveBeenCalledWith(50);
            expect(mockOffset).toHaveBeenCalledWith(10);
        });

        it('should return empty array when no history found', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue([]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy,
                limit: mockLimit,
                offset: mockOffset
            };

            getDb.mockReturnValue(db);

            const result = await model.findRateHistory({
                fromCurrency: 'EUR',
                toCurrency: 'ARS'
            });

            expect(result).toEqual([]);
        });
    });

    describe('findLatestRates with tx propagation', () => {
        it('should use the tx client for both subquery and outer query when tx is provided', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockGroupBy = vi.fn().mockReturnThis();
            const mockAs = vi.fn().mockReturnThis();
            const mockInnerJoin = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockReturnThis();
            const mockOffset = vi.fn().mockResolvedValue([]);

            const txClient = {
                select: mockSelect,
                from: mockFrom,
                groupBy: mockGroupBy,
                as: mockAs,
                innerJoin: mockInnerJoin,
                limit: mockLimit,
                offset: mockOffset
            } as unknown as import('../../../src/types').DrizzleClient;

            await model.findLatestRates(undefined, txClient);

            expect(getDb).not.toHaveBeenCalled();
            expect(mockSelect).toHaveBeenCalled();
        });
    });

    describe('findManualOverrides', () => {
        it('should return all manual override rates', async () => {
            const mockRates = [
                {
                    id: 'rate-1',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1100,
                    rateType: 'CUSTOM',
                    source: 'MANUAL',
                    isManualOverride: true,
                    createdAt: new Date('2026-02-14T10:00:00Z')
                },
                {
                    id: 'rate-2',
                    fromCurrency: 'EUR',
                    toCurrency: 'ARS',
                    rate: 1200,
                    rateType: 'CUSTOM',
                    source: 'MANUAL',
                    isManualOverride: true,
                    createdAt: new Date('2026-02-13T10:00:00Z')
                }
            ];

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockResolvedValue(mockRates);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy
            };

            getDb.mockReturnValue(db);

            const result = await model.findManualOverrides();

            expect(result).toEqual(mockRates);
            expect(mockSelect).toHaveBeenCalled();
            expect(mockFrom).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalled();
            expect(mockOrderBy).toHaveBeenCalled();
        });

        it('should return empty array when no manual overrides exist', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockResolvedValue([]);

            const db = {
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                orderBy: mockOrderBy
            };

            getDb.mockReturnValue(db);

            const result = await model.findManualOverrides();

            expect(result).toEqual([]);
        });
    });
});
