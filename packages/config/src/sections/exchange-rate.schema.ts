import { z } from 'zod';

/**
 * Exchange rate API configuration schema
 */
export const ExchangeRateSchema = z.object({
    /**
     * ExchangeRate-API key (optional for development)
     */
    HOSPEDA_EXCHANGE_RATE_API_KEY: z.string().optional(),

    /**
     * Dolar API base URL for Argentine peso exchange rates
     * @default 'https://dolarapi.com/v1'
     */
    HOSPEDA_DOLAR_API_BASE_URL: z.string().url().default('https://dolarapi.com/v1'),

    /**
     * ExchangeRate-API base URL for global exchange rates
     * @default 'https://v6.exchangerate-api.com/v6'
     */
    HOSPEDA_EXCHANGE_RATE_API_BASE_URL: z
        .string()
        .url()
        .default('https://v6.exchangerate-api.com/v6')
});

/**
 * Inferred TypeScript type from exchange rate schema
 */
export type ExchangeRateConfig = z.infer<typeof ExchangeRateSchema>;

/**
 * Parses and validates exchange rate environment variables
 *
 * @param env - Environment variables object
 * @returns Validated exchange rate configuration
 *
 * @example
 * ```ts
 * const config = parseExchangeRateSchema(process.env);
 * console.log(config.HOSPEDA_DOLAR_API_BASE_URL);
 * // => 'https://dolarapi.com/v1'
 * ```
 */
export function parseExchangeRateSchema(
    env: Record<string, string | undefined>
): ExchangeRateConfig {
    return ExchangeRateSchema.parse({
        HOSPEDA_EXCHANGE_RATE_API_KEY: env.HOSPEDA_EXCHANGE_RATE_API_KEY,
        HOSPEDA_DOLAR_API_BASE_URL: env.HOSPEDA_DOLAR_API_BASE_URL,
        HOSPEDA_EXCHANGE_RATE_API_BASE_URL: env.HOSPEDA_EXCHANGE_RATE_API_BASE_URL
    });
}
