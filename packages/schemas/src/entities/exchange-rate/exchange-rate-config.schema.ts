import { z } from 'zod';
import { ExchangeRateTypeEnum } from '../../enums/exchange-rate-type.enum.js';
import { ExchangeRateTypeEnumSchema } from '../../enums/exchange-rate-type.schema.js';

/**
 * Exchange Rate Config Schema
 *
 * Represents configuration settings for exchange rate fetching and display.
 * This is a singleton configuration row that controls how the system handles
 * currency conversions and external API integrations.
 *
 * @property id - Unique identifier (UUID)
 * @property defaultRateType - Which ARS rate to use by default (oficial, blue, etc.)
 * @property dolarApiFetchIntervalMinutes - How often to fetch from DolarAPI (minutes)
 * @property exchangeRateApiFetchIntervalHours - How often to fetch from ExchangeRateAPI (hours)
 * @property showConversionDisclaimer - Whether to show disclaimer on conversions
 * @property disclaimerText - Custom disclaimer text (optional)
 * @property enableAutoFetch - Whether automatic fetching is enabled
 * @property updatedAt - Last update timestamp
 * @property updatedById - User who last updated the config (optional)
 */
export const ExchangeRateConfigSchema = z.object({
    /**
     * Unique identifier for the configuration row
     */
    id: z
        .string({
            message: 'zodError.exchangeRateConfig.id.required'
        })
        .uuid({
            message: 'zodError.exchangeRateConfig.id.invalidUuid'
        }),

    /**
     * Default exchange rate type to use for conversions
     * Defaults to 'oficial' (official rate)
     */
    defaultRateType: ExchangeRateTypeEnumSchema.default(ExchangeRateTypeEnum.OFICIAL),

    /**
     * Interval for fetching from DolarAPI in minutes
     * Must be a positive integer. Default: 15 minutes
     */
    dolarApiFetchIntervalMinutes: z
        .number({
            message: 'zodError.exchangeRateConfig.dolarApiFetchIntervalMinutes.required'
        })
        .int({ message: 'zodError.exchangeRateConfig.dolarApiFetchIntervalMinutes.mustBeInteger' })
        .positive({
            message: 'zodError.exchangeRateConfig.dolarApiFetchIntervalMinutes.mustBePositive'
        })
        .default(15),

    /**
     * Interval for fetching from ExchangeRateAPI in hours
     * Must be a positive integer. Default: 6 hours
     */
    exchangeRateApiFetchIntervalHours: z
        .number({
            message: 'zodError.exchangeRateConfig.exchangeRateApiFetchIntervalHours.required'
        })
        .int({
            message: 'zodError.exchangeRateConfig.exchangeRateApiFetchIntervalHours.mustBeInteger'
        })
        .positive({
            message: 'zodError.exchangeRateConfig.exchangeRateApiFetchIntervalHours.mustBePositive'
        })
        .default(6),

    /**
     * Whether to show conversion disclaimer to users
     * Default: true
     */
    showConversionDisclaimer: z
        .boolean({
            message: 'zodError.exchangeRateConfig.showConversionDisclaimer.required'
        })
        .default(true),

    /**
     * Custom disclaimer text shown to users
     * Optional and nullable
     */
    disclaimerText: z
        .string({
            message: 'zodError.exchangeRateConfig.disclaimerText.required'
        })
        .optional()
        .nullable(),

    /**
     * Whether automatic rate fetching is enabled
     * Default: true
     */
    enableAutoFetch: z
        .boolean({
            message: 'zodError.exchangeRateConfig.enableAutoFetch.required'
        })
        .default(true),

    /**
     * Timestamp of last configuration update
     */
    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    }),

    /**
     * User ID who last updated the configuration
     * Optional and nullable
     */
    updatedById: z
        .string({
            message: 'zodError.exchangeRateConfig.updatedById.required'
        })
        .uuid({ message: 'zodError.exchangeRateConfig.updatedById.invalidUuid' })
        .optional()
        .nullable()
});

/**
 * Inferred TypeScript type from ExchangeRateConfigSchema
 */
export type ExchangeRateConfig = z.infer<typeof ExchangeRateConfigSchema>;
