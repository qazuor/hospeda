/**
 * exchangeRateConfigFactory.ts
 *
 * Factory functions and builder for generating ExchangeRateConfig mock data for tests.
 */

import type { ExchangeRateConfig } from '@repo/schemas';
import { ExchangeRateTypeEnum } from '@repo/schemas';
import { BaseFactoryBuilder } from './baseEntityFactory.js';
import { getMockId } from './utilsFactory.js';

/**
 * Base exchange rate config object with default values.
 */
const baseExchangeRateConfig: ExchangeRateConfig = {
    id: getMockId('exchangeRateConfig'),
    defaultRateType: ExchangeRateTypeEnum.OFICIAL,
    dolarApiFetchIntervalMinutes: 15,
    exchangeRateApiFetchIntervalHours: 6,
    showConversionDisclaimer: true,
    disclaimerText: null,
    enableAutoFetch: true,
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    updatedById: null
};

/**
 * Creates a mock ExchangeRateConfig object using the builder pattern.
 * @param overrides - Partial config object to override default values.
 * @returns {ExchangeRateConfig} A complete mock ExchangeRateConfig object.
 * @example
 * const config = createExchangeRateConfig({ defaultRateType: ExchangeRateTypeEnum.BLUE });
 */
export const createExchangeRateConfig = (
    overrides: Partial<ExchangeRateConfig> = {}
): ExchangeRateConfig => new ExchangeRateConfigFactoryBuilder().with(overrides).build();

/**
 * Builder pattern for generating ExchangeRateConfig mocks in tests.
 *
 * Allows fluent, type-safe creation of ExchangeRateConfig objects.
 *
 * @example
 * const config = new ExchangeRateConfigFactoryBuilder()
 *   .withDefaultRateType(ExchangeRateTypeEnum.BLUE)
 *   .withAutoFetchDisabled()
 *   .build();
 */
export class ExchangeRateConfigFactoryBuilder extends BaseFactoryBuilder<ExchangeRateConfig> {
    constructor() {
        super(baseExchangeRateConfig);
    }

    /**
     * Sets the default rate type.
     * @param defaultRateType - The default rate type to use
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withDefaultRateType(defaultRateType: ExchangeRateTypeEnum): this {
        return this.with({ defaultRateType });
    }

    /**
     * Sets the DolarAPI fetch interval in minutes.
     * @param minutes - Fetch interval in minutes
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withDolarApiFetchInterval(minutes: number): this {
        return this.with({ dolarApiFetchIntervalMinutes: minutes });
    }

    /**
     * Sets the ExchangeRateAPI fetch interval in hours.
     * @param hours - Fetch interval in hours
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withExchangeRateApiFetchInterval(hours: number): this {
        return this.with({ exchangeRateApiFetchIntervalHours: hours });
    }

    /**
     * Disables the conversion disclaimer.
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withDisclaimerDisabled(): this {
        return this.with({ showConversionDisclaimer: false });
    }

    /**
     * Sets a custom disclaimer text.
     * @param text - The disclaimer text
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withDisclaimerText(text: string): this {
        return this.with({ disclaimerText: text });
    }

    /**
     * Disables automatic fetching.
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withAutoFetchDisabled(): this {
        return this.with({ enableAutoFetch: false });
    }

    /**
     * Sets the updated by user ID.
     * @param userId - The user ID who updated the config
     * @returns {ExchangeRateConfigFactoryBuilder} The builder instance for chaining.
     */
    public withUpdatedBy(userId: string): this {
        return this.with({ updatedById: userId });
    }
}
