import { ExchangeRateTypeEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { ExchangeRateConfigModel } from '../../../src/models/exchange-rate/exchange-rate-config.model';
import * as logger from '../../../src/utils/logger';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('ExchangeRateConfigModel', () => {
    let model: ExchangeRateConfigModel;
    let _getDb: ReturnType<typeof vi.fn>;
    let _logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new ExchangeRateConfigModel();
        _logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        _getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('exchange_rate_config');
        });
    });

    describe('getConfig', () => {
        it('should return existing config when one exists', async () => {
            const existingConfig = {
                id: 'config-uuid-1',
                defaultRateType: ExchangeRateTypeEnum.BLUE,
                dolarApiFetchIntervalMinutes: 20,
                exchangeRateApiFetchIntervalHours: 8,
                showConversionDisclaimer: false,
                disclaimerText: 'Custom disclaimer',
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: 'user-uuid-1'
            };

            // Mock findAll to return existing config
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [existingConfig],
                total: 1
            });

            const result = await model.getConfig();

            expect(mockFindAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 1 },
                undefined,
                undefined
            );
            expect(result).toEqual(existingConfig);

            mockFindAll.mockRestore();
        });

        it('should create and return default config when none exists', async () => {
            const createdConfig = {
                id: 'config-uuid-new',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            // Mock findAll to return empty result
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            // Mock create to return new config
            const mockCreate = vi.spyOn(model, 'create').mockResolvedValue(createdConfig);

            const result = await model.getConfig();

            expect(mockFindAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 1 },
                undefined,
                undefined
            );
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                    dolarApiFetchIntervalMinutes: 15,
                    exchangeRateApiFetchIntervalHours: 6,
                    showConversionDisclaimer: true,
                    disclaimerText: null,
                    enableAutoFetch: true,
                    updatedAt: expect.any(Date),
                    updatedById: null
                }),
                undefined
            );
            expect(result).toEqual(createdConfig);

            mockFindAll.mockRestore();
            mockCreate.mockRestore();
        });

        it('should pass transaction to findAll and create', async () => {
            const mockTx = {} as never;
            const createdConfig = {
                id: 'config-uuid-tx',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            const mockCreate = vi.spyOn(model, 'create').mockResolvedValue(createdConfig);

            await model.getConfig(mockTx);

            expect(mockFindAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 1 },
                undefined,
                mockTx
            );
            expect(mockCreate).toHaveBeenCalledWith(expect.any(Object), mockTx);

            mockFindAll.mockRestore();
            mockCreate.mockRestore();
        });
    });

    describe('updateConfig', () => {
        it('should update existing config when one exists', async () => {
            const existingConfig = {
                id: 'config-uuid-1',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date('2024-01-01'),
                updatedById: 'old-user-id'
            };

            const updatedConfig = {
                ...existingConfig,
                defaultRateType: ExchangeRateTypeEnum.BLUE,
                enableAutoFetch: false,
                updatedAt: new Date(),
                updatedById: 'user-uuid-2'
            };

            // Mock findAll to return existing config
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [existingConfig],
                total: 1
            });

            // Mock update to return updated config
            const mockUpdate = vi.spyOn(model, 'update').mockResolvedValue(updatedConfig);

            const result = await model.updateConfig({
                data: {
                    defaultRateType: ExchangeRateTypeEnum.BLUE,
                    enableAutoFetch: false
                },
                updatedById: 'user-uuid-2'
            });

            expect(mockFindAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 1 },
                undefined,
                undefined
            );
            expect(mockUpdate).toHaveBeenCalledWith(
                { id: existingConfig.id },
                expect.objectContaining({
                    defaultRateType: ExchangeRateTypeEnum.BLUE,
                    enableAutoFetch: false,
                    updatedAt: expect.any(Date),
                    updatedById: 'user-uuid-2'
                }),
                undefined
            );
            expect(result).toEqual(updatedConfig);

            mockFindAll.mockRestore();
            mockUpdate.mockRestore();
        });

        it('should throw error if update returns null', async () => {
            const existingConfig = {
                id: 'config-uuid-1',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [existingConfig],
                total: 1
            });

            // Mock update to return null (simulating update failure)
            const mockUpdate = vi.spyOn(model, 'update').mockResolvedValue(null);

            await expect(
                model.updateConfig({
                    data: { enableAutoFetch: false },
                    updatedById: 'user-uuid-2'
                })
            ).rejects.toThrow('Failed to update exchange rate configuration');

            mockFindAll.mockRestore();
            mockUpdate.mockRestore();
        });

        it('should create new config with defaults when none exists', async () => {
            const createdConfig = {
                id: 'config-uuid-new',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: false,
                updatedAt: new Date(),
                updatedById: 'user-uuid-3'
            };

            // Mock findAll to return empty result
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            // Mock create to return new config
            const mockCreate = vi.spyOn(model, 'create').mockResolvedValue(createdConfig);

            const result = await model.updateConfig({
                data: { enableAutoFetch: false },
                updatedById: 'user-uuid-3'
            });

            expect(mockFindAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 1 },
                undefined,
                undefined
            );
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                    dolarApiFetchIntervalMinutes: 15,
                    exchangeRateApiFetchIntervalHours: 6,
                    showConversionDisclaimer: true,
                    disclaimerText: null,
                    enableAutoFetch: false,
                    updatedAt: expect.any(Date),
                    updatedById: 'user-uuid-3'
                }),
                undefined
            );
            expect(result).toEqual(createdConfig);

            mockFindAll.mockRestore();
            mockCreate.mockRestore();
        });

        it('should merge custom data with defaults when creating new config', async () => {
            const createdConfig = {
                id: 'config-uuid-merged',
                defaultRateType: ExchangeRateTypeEnum.BLUE,
                dolarApiFetchIntervalMinutes: 30,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: false,
                disclaimerText: 'Test disclaimer',
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: 'user-uuid-4'
            };

            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            const mockCreate = vi.spyOn(model, 'create').mockResolvedValue(createdConfig);

            const result = await model.updateConfig({
                data: {
                    defaultRateType: ExchangeRateTypeEnum.BLUE,
                    dolarApiFetchIntervalMinutes: 30,
                    showConversionDisclaimer: false,
                    disclaimerText: 'Test disclaimer'
                },
                updatedById: 'user-uuid-4'
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultRateType: ExchangeRateTypeEnum.BLUE,
                    dolarApiFetchIntervalMinutes: 30,
                    exchangeRateApiFetchIntervalHours: 6,
                    showConversionDisclaimer: false,
                    disclaimerText: 'Test disclaimer',
                    enableAutoFetch: true,
                    updatedAt: expect.any(Date),
                    updatedById: 'user-uuid-4'
                }),
                undefined
            );
            expect(result).toEqual(createdConfig);

            mockFindAll.mockRestore();
            mockCreate.mockRestore();
        });

        it('should pass transaction to findAll, update, and create', async () => {
            const mockTx = {} as never;
            const existingConfig = {
                id: 'config-uuid-tx',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            const updatedConfig = {
                ...existingConfig,
                enableAutoFetch: false,
                updatedAt: new Date(),
                updatedById: 'user-uuid-tx'
            };

            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [existingConfig],
                total: 1
            });

            const mockUpdate = vi.spyOn(model, 'update').mockResolvedValue(updatedConfig);

            await model.updateConfig(
                {
                    data: { enableAutoFetch: false },
                    updatedById: 'user-uuid-tx'
                },
                mockTx
            );

            expect(mockFindAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 1 },
                undefined,
                mockTx
            );
            expect(mockUpdate).toHaveBeenCalledWith(
                { id: existingConfig.id },
                expect.any(Object),
                mockTx
            );

            mockFindAll.mockRestore();
            mockUpdate.mockRestore();
        });

        it('should handle null updatedById', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            const createdConfig = {
                id: 'config-uuid-null-user',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            const mockCreate = vi.spyOn(model, 'create').mockResolvedValue(createdConfig);

            const result = await model.updateConfig({
                data: {},
                updatedById: null
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedById: null
                }),
                undefined
            );
            expect(result.updatedById).toBeNull();

            mockFindAll.mockRestore();
            mockCreate.mockRestore();
        });
    });
});
