import { z } from 'zod';

/**
 * Environment configuration schema for AI image generation
 *
 * @description Validates and loads environment variables required for
 * AI image generation using Replicate API
 */
const envConfigSchema = z.object({
    /**
     * Replicate API token for authentication
     *
     * @required
     * @example "r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
     */
    replicateApiToken: z
        .string()
        .min(1, 'REPLICATE_API_TOKEN environment variable is required')
        .transform((val) => val.trim())
        .refine((val) => val.length > 0, 'REPLICATE_API_TOKEN environment variable is required'),

    /**
     * Replicate model to use for image generation
     *
     * @default "black-forest-labs/flux-schnell"
     * @example "black-forest-labs/flux-dev"
     */
    replicateModel: z
        .string()
        .default('black-forest-labs/flux-schnell')
        .transform((val) => val.trim())
        .refine((val) => val.length > 0, 'REPLICATE_MODEL must be a non-empty string')
});

/**
 * Environment configuration type inferred from Zod schema
 */
export type EnvConfig = z.infer<typeof envConfigSchema>;

/**
 * Loads and validates environment configuration for AI image generation
 *
 * @returns Validated environment configuration
 * @throws {Error} If environment variables are invalid or missing
 *
 * @example
 * ```ts
 * const config = loadEnvConfig();
 * console.log(config.replicateApiToken); // "r8_..."
 * console.log(config.replicateModel); // "black-forest-labs/flux-schnell"
 * ```
 */
export function loadEnvConfig(): EnvConfig {
    // Validate required environment variables manually for better error messages
    const apiToken = process.env.REPLICATE_API_TOKEN;
    const model = process.env.REPLICATE_MODEL;

    // Check if API token exists and is not empty after trimming
    if (!apiToken || apiToken.trim().length === 0) {
        throw new Error('REPLICATE_API_TOKEN environment variable is required');
    }

    // Check if model is empty when provided
    if (model !== undefined && model.trim().length === 0) {
        throw new Error('REPLICATE_MODEL must be a non-empty string');
    }

    const result = envConfigSchema.safeParse({
        replicateApiToken: apiToken,
        replicateModel: model
    });

    if (!result.success) {
        // This should never happen since we validate above, but keeping type safety
        throw new Error('Invalid environment configuration');
    }

    return result.data;
}
