import { ExchangeRateConfigModel } from '@repo/db';
import { ExchangeRateTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExchangeRateConfigService } from '../../../src/services/exchange-rate/exchange-rate-config.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { createExchangeRateConfig } from '../../factories/exchangeRateConfigFactory.js';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

describe('ExchangeRateConfigService', () => {
    let service: ExchangeRateConfigService;
    let modelMock: ExchangeRateConfigModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(ExchangeRateConfigModel, [
            'findAll',
            'update',
            'create',
            'getConfig',
            'updateConfig'
        ]);
        loggerMock = createLoggerMock();
        service = new ExchangeRateConfigService({ logger: loggerMock }, modelMock);
        actor = createActor({ permissions: [PermissionEnum.EXCHANGE_RATE_VIEW] });
    });

    describe('getConfig', () => {
        it('should return existing config when config exists', async () => {
            const existingConfig = createExchangeRateConfig({
                defaultRateType: ExchangeRateTypeEnum.BLUE
            });

            asMock(modelMock.getConfig).mockResolvedValue(existingConfig);

            const result = await service.getConfig({ actor });

            expectSuccess(result);
            expect(result.data).toEqual(existingConfig);
            expect(result.data?.defaultRateType).toBe(ExchangeRateTypeEnum.BLUE);
        });

        it('should return default config when no config exists', async () => {
            const defaultConfig = createExchangeRateConfig({
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                enableAutoFetch: true
            });

            asMock(modelMock.getConfig).mockResolvedValue(defaultConfig);

            const result = await service.getConfig({ actor });

            expectSuccess(result);
            expect(result.data).toBeDefined();
            expect(result.data?.defaultRateType).toBe(ExchangeRateTypeEnum.OFICIAL);
            expect(result.data?.dolarApiFetchIntervalMinutes).toBe(15);
            expect(result.data?.exchangeRateApiFetchIntervalHours).toBe(6);
            expect(result.data?.showConversionDisclaimer).toBe(true);
            expect(result.data?.enableAutoFetch).toBe(true);
        });

        it('should return FORBIDDEN error when actor lacks EXCHANGE_RATE_VIEW permission', async () => {
            actor = createActor({ permissions: [] });

            const result = await service.getConfig({ actor });

            expectForbiddenError(result);
        });

        it('should return INTERNAL_ERROR when model throws', async () => {
            asMock(modelMock.getConfig).mockRejectedValue(new Error('DB error'));

            const result = await service.getConfig({ actor });

            expectInternalError(result);
        });
    });

    describe('updateConfig', () => {
        const existingConfig = createExchangeRateConfig();
        const updateData = {
            defaultRateType: ExchangeRateTypeEnum.BLUE,
            dolarApiFetchIntervalMinutes: 30,
            enableAutoFetch: false
        };

        beforeEach(() => {
            actor = createActor({ permissions: [PermissionEnum.EXCHANGE_RATE_CONFIG_UPDATE] });
        });

        it('should update existing config successfully', async () => {
            const updatedConfig = { ...existingConfig, ...updateData };

            asMock(modelMock.updateConfig).mockResolvedValue(updatedConfig);

            const result = await service.updateConfig({ actor, data: updateData });

            expectSuccess(result);
            expect(result.data).toMatchObject(updateData);
            expect(asMock(modelMock.updateConfig)).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining(updateData),
                    updatedById: actor.id
                })
            );
        });

        it('should create new config when no config exists', async () => {
            const newConfig = createExchangeRateConfig(updateData);

            asMock(modelMock.updateConfig).mockResolvedValue(newConfig);

            const result = await service.updateConfig({ actor, data: updateData });

            expectSuccess(result);
            expect(result.data).toMatchObject(updateData);
        });

        it('should apply default values when creating new config with partial data', async () => {
            const partialData = { defaultRateType: ExchangeRateTypeEnum.BLUE };
            const newConfig = createExchangeRateConfig({
                ...partialData,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                enableAutoFetch: true
            });

            asMock(modelMock.updateConfig).mockResolvedValue(newConfig);

            const result = await service.updateConfig({ actor, data: partialData });

            expectSuccess(result);
            expect(result.data?.defaultRateType).toBe(ExchangeRateTypeEnum.BLUE);
        });

        it('should return FORBIDDEN error when actor lacks EXCHANGE_RATE_CONFIG_UPDATE permission', async () => {
            actor = createActor({ permissions: [PermissionEnum.EXCHANGE_RATE_VIEW] });

            const result = await service.updateConfig({ actor, data: updateData });

            expectForbiddenError(result);
        });

        it('should return VALIDATION_ERROR for invalid data', async () => {
            const invalidData = {
                dolarApiFetchIntervalMinutes: -5 // Invalid: must be positive
            };

            const result = await service.updateConfig({ actor, data: invalidData });

            expectValidationError(result);
        });

        it('should return VALIDATION_ERROR for non-integer fetch intervals', async () => {
            const invalidData = {
                dolarApiFetchIntervalMinutes: 15.5 // Invalid: must be integer
            };

            const result = await service.updateConfig({ actor, data: invalidData });

            expectValidationError(result);
        });

        it('should return INTERNAL_ERROR when update fails', async () => {
            asMock(modelMock.updateConfig).mockResolvedValue(null);

            const result = await service.updateConfig({ actor, data: updateData });

            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('Failed to update exchange rate configuration');
        });

        it('should return INTERNAL_ERROR when model throws', async () => {
            asMock(modelMock.updateConfig).mockRejectedValue(new Error('DB error'));

            const result = await service.updateConfig({ actor, data: updateData });

            expectInternalError(result);
        });

        it('should allow updating only disclaimer text', async () => {
            const disclaimerUpdate = {
                disclaimerText: 'Custom disclaimer message'
            };
            const updatedConfig = { ...existingConfig, ...disclaimerUpdate };

            asMock(modelMock.updateConfig).mockResolvedValue(updatedConfig);

            const result = await service.updateConfig({ actor, data: disclaimerUpdate });

            expectSuccess(result);
            expect(result.data?.disclaimerText).toBe('Custom disclaimer message');
        });

        it('should allow disabling conversion disclaimer', async () => {
            const disclaimerUpdate = {
                showConversionDisclaimer: false
            };
            const updatedConfig = { ...existingConfig, ...disclaimerUpdate };

            asMock(modelMock.updateConfig).mockResolvedValue(updatedConfig);

            const result = await service.updateConfig({ actor, data: disclaimerUpdate });

            expectSuccess(result);
            expect(result.data?.showConversionDisclaimer).toBe(false);
        });
    });
});
