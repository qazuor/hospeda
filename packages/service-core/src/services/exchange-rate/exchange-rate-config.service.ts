import { ExchangeRateConfigModel } from '@repo/db';
import {
    type ExchangeRateConfig,
    type ExchangeRateConfigUpdateInput,
    ExchangeRateConfigUpdateInputSchema,
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
     * Delegates to model's getConfig() which handles singleton pattern
     * (returns existing or creates default).
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
                checkCanViewExchangeRate(actor);

                return this.model.getConfig();
            }
        });
    }

    /**
     * Updates the exchange rate configuration.
     *
     * Delegates to model's updateConfig() which handles singleton pattern
     * (updates existing or creates with defaults merged).
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
                checkCanUpdateExchangeRateConfig(actor);

                const updatedConfig = await this.model.updateConfig({
                    data: validatedData,
                    updatedById: actor.id
                });

                if (!updatedConfig) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update exchange rate configuration'
                    );
                }

                return updatedConfig;
            }
        });
    }
}
