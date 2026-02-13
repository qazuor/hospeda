import { ExchangeRateConfigModel } from '@repo/db';
import {
    type ExchangeRateConfig,
    type ExchangeRateConfigUpdateInput,
    ExchangeRateConfigUpdateInputSchema,
    ExchangeRateTypeEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import {
    checkCanUpdateExchangeRateConfig,
    checkCanViewExchangeRate
} from './exchange-rate.permissions.js';

/**
 * Schema wrapper for updateConfig input validation.
 * Validates the data object within the service method input.
 */
const UpdateConfigInputSchema = z.object({
    data: ExchangeRateConfigUpdateInputSchema
});

/**
 * Service for managing the singleton exchange rate configuration.
 *
 * Exchange rate config is a singleton entity (only one row in the database).
 * This service does NOT extend BaseCrudService because standard CRUD operations
 * (create, delete, restore) are not applicable to a singleton.
 *
 * Available operations:
 * - getConfig(): Retrieve current configuration
 * - updateConfig(): Update configuration settings
 */
export class ExchangeRateConfigService extends BaseService {
    static readonly ENTITY_NAME = 'exchange_rate_config';
    protected readonly entityName = ExchangeRateConfigService.ENTITY_NAME;
    protected readonly model: ExchangeRateConfigModel;

    constructor(ctx: ServiceContext, model?: ExchangeRateConfigModel) {
        super(ctx, ExchangeRateConfigService.ENTITY_NAME);
        this.model = model ?? new ExchangeRateConfigModel();
    }

    /**
     * Gets the exchange rate configuration.
     *
     * Returns the singleton configuration row. If no configuration exists in the database,
     * returns a default configuration object with sensible defaults.
     *
     * @param input - Input parameters
     * @param input.actor - Actor performing the action
     * @returns Service output containing the configuration or error
     *
     * @example
     * ```ts
     * const service = new ExchangeRateConfigService(ctx);
     * const result = await service.getConfig({ actor });
     *
     * if (result.data) {
     *   console.log('Default rate type:', result.data.defaultRateType);
     *   console.log('Auto-fetch enabled:', result.data.enableAutoFetch);
     * }
     * ```
     */
    public async getConfig(input: {
        actor: Actor;
    }): Promise<ServiceOutput<ExchangeRateConfig>> {
        const { actor } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'getConfig',
            input: { actor },
            schema: ExchangeRateConfigUpdateInputSchema.pick({}), // Empty validation
            execute: async () => {
                // 1. Check permission
                checkCanViewExchangeRate(actor);

                // 2. Get config from model
                const result = await this.model.findAll({});
                const config = result.items[0];

                // 3. If no config exists, return default values
                if (!config) {
                    const defaultConfig: ExchangeRateConfig = {
                        id: '00000000-0000-0000-0000-000000000000', // Placeholder ID
                        defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                        dolarApiFetchIntervalMinutes: 15,
                        exchangeRateApiFetchIntervalHours: 6,
                        showConversionDisclaimer: true,
                        disclaimerText: null,
                        enableAutoFetch: true,
                        updatedAt: new Date(),
                        updatedById: null
                    };
                    return defaultConfig;
                }

                // 4. Return existing config
                return config;
            }
        });
    }

    /**
     * Updates the exchange rate configuration.
     *
     * Updates the singleton configuration row with new settings. If no configuration
     * exists, creates a new one with the provided values merged with defaults.
     *
     * @param input - Input parameters
     * @param input.actor - Actor performing the action
     * @param input.data - Configuration updates (partial)
     * @returns Service output containing updated configuration or error
     *
     * @example
     * ```ts
     * const service = new ExchangeRateConfigService(ctx);
     * const result = await service.updateConfig({
     *   actor,
     *   data: {
     *     defaultRateType: ExchangeRateTypeEnum.BLUE,
     *     dolarApiFetchIntervalMinutes: 30,
     *     enableAutoFetch: false
     *   }
     * });
     *
     * if (result.data) {
     *   console.log('Config updated:', result.data);
     * }
     * ```
     */
    public async updateConfig(input: {
        actor: Actor;
        data: ExchangeRateConfigUpdateInput;
    }): Promise<ServiceOutput<ExchangeRateConfig>> {
        const { actor, data } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'updateConfig',
            input: { actor, data },
            schema: UpdateConfigInputSchema,
            execute: async (validatedInput: { data: ExchangeRateConfigUpdateInput }) => {
                const validatedData = validatedInput.data;
                // 1. Check permission
                checkCanUpdateExchangeRateConfig(actor);

                // 2. Get existing config (or prepare default)
                const result = await this.model.findAll({});
                const existingConfig = result.items[0];

                // 3. Update or create the config row
                let updatedConfig: ExchangeRateConfig;

                if (existingConfig) {
                    // Update existing config
                    const updateResult = await this.model.update(
                        { id: existingConfig.id },
                        {
                            ...validatedData,
                            updatedAt: new Date(),
                            updatedById: actor.id
                        }
                    );

                    if (!updateResult) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to update exchange rate configuration'
                        );
                    }

                    updatedConfig = updateResult;
                } else {
                    // Create new config with defaults merged with provided data
                    const newConfig = await this.model.create({
                        defaultRateType:
                            validatedData.defaultRateType ?? ExchangeRateTypeEnum.OFICIAL,
                        dolarApiFetchIntervalMinutes:
                            validatedData.dolarApiFetchIntervalMinutes ?? 15,
                        exchangeRateApiFetchIntervalHours:
                            validatedData.exchangeRateApiFetchIntervalHours ?? 6,
                        showConversionDisclaimer: validatedData.showConversionDisclaimer ?? true,
                        disclaimerText: validatedData.disclaimerText ?? null,
                        enableAutoFetch: validatedData.enableAutoFetch ?? true,
                        updatedAt: new Date(),
                        updatedById: actor.id
                    });

                    updatedConfig = newConfig;
                }

                // 4. Return updated config
                return updatedConfig;
            }
        });
    }
}
