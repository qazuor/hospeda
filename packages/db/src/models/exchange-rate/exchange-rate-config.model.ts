import type { ExchangeRateConfig } from '@repo/schemas';
import { ExchangeRateTypeEnum } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { exchangeRateConfig } from '../../schemas/exchange-rate/exchange-rate-config.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Default configuration values for exchange rate settings.
 * Used when no configuration row exists in the database.
 */
const DEFAULT_CONFIG = {
    defaultRateType: ExchangeRateTypeEnum.OFICIAL,
    dolarApiFetchIntervalMinutes: 15,
    exchangeRateApiFetchIntervalHours: 6,
    showConversionDisclaimer: true,
    disclaimerText: null,
    enableAutoFetch: true
} as const;

/**
 * Input for updating exchange rate configuration.
 */
interface UpdateConfigInput {
    data: Partial<Omit<ExchangeRateConfig, 'id' | 'updatedAt' | 'updatedById'>>;
    updatedById: string | null;
}

/**
 * Model for exchange rate configuration.
 *
 * Manages singleton configuration for exchange rate settings including
 * currencies, update frequency, and API integration.
 *
 * This is a singleton model - only one configuration row should exist.
 * Methods handle automatic creation if config does not exist.
 */
export class ExchangeRateConfigModel extends BaseModelImpl<ExchangeRateConfig> {
    protected table = exchangeRateConfig;
    public entityName = 'exchange_rate_config';

    protected getTableName(): string {
        return 'exchange_rate_config';
    }

    /**
     * Retrieves the singleton exchange rate configuration.
     * If no configuration exists, creates one with default values.
     *
     * @param tx - Optional transaction client
     * @returns Promise resolving to the exchange rate configuration
     *
     * @example
     * ```ts
     * const model = new ExchangeRateConfigModel();
     * const config = await model.getConfig();
     * console.log(config.defaultRateType); // 'oficial'
     * ```
     */
    async getConfig(tx?: DrizzleClient): Promise<ExchangeRateConfig> {
        const result = await this.findAll({}, { page: 1, pageSize: 1 }, undefined, tx);
        const existingConfig = result.items[0];

        if (existingConfig) {
            return existingConfig;
        }

        // No config exists, create one with defaults
        const newConfig = await this.create(
            {
                ...DEFAULT_CONFIG,
                updatedAt: new Date(),
                updatedById: null
            },
            tx
        );

        return newConfig;
    }

    /**
     * Updates the singleton exchange rate configuration.
     * If no configuration exists, creates one with the provided data merged with defaults.
     *
     * @param input - Object containing data to update and the ID of the user making the update
     * @param tx - Optional transaction client
     * @returns Promise resolving to the updated configuration
     *
     * @example
     * ```ts
     * const model = new ExchangeRateConfigModel();
     * const updated = await model.updateConfig({
     *   data: {
     *     defaultRateType: ExchangeRateTypeEnum.BLUE,
     *     enableAutoFetch: false
     *   },
     *   updatedById: 'user-uuid-123'
     * });
     * console.log(updated.defaultRateType); // 'blue'
     * ```
     */
    async updateConfig(input: UpdateConfigInput, tx?: DrizzleClient): Promise<ExchangeRateConfig> {
        const { data, updatedById } = input;
        const result = await this.findAll({}, { page: 1, pageSize: 1 }, undefined, tx);
        const existingConfig = result.items[0];

        const updatePayload = {
            ...data,
            updatedAt: new Date(),
            updatedById
        };

        if (existingConfig) {
            // Update existing config
            const updated = await this.update({ id: existingConfig.id }, updatePayload, tx);

            if (!updated) {
                throw new Error('Failed to update exchange rate configuration');
            }

            return updated;
        }

        // No config exists, create one with data merged with defaults
        const newConfig = await this.create(
            {
                ...DEFAULT_CONFIG,
                ...updatePayload
            },
            tx
        );

        return newConfig;
    }
}

/** Singleton instance of ExchangeRateConfigModel for use across the application. */
export const exchangeRateConfigModel = new ExchangeRateConfigModel();
