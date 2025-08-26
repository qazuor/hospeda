import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStartupValidator } from '@repo/config';
/**
 * Environment configuration with validation for Web App
 * Uses @repo/config for centralized environment variable management
 */
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from root directory
const rootDir = resolve(__dirname, '../../../..');
const envFiles = [resolve(rootDir, '.env.local'), resolve(rootDir, '.env')];

if (process.env.NODE_ENV === 'test') {
    envFiles.unshift(resolve(rootDir, '.env.test'));
}

// Load environment variables
for (const envFile of envFiles) {
    // Only try to load files that actually exist
    if (!existsSync(envFile)) {
        continue;
    }

    try {
        const result = config({ path: envFile });
        if (result?.error) {
            console.warn(`⚠️  Could not load ${envFile}: ${result.error.message}`);
        }
    } catch (error) {
        console.warn(
            `⚠️  Error loading ${envFile}:`,
            error instanceof Error ? error.message : String(error)
        );
    }
}

/**
 * Web App-specific environment schema
 * Handles both monorepo (HOSPEDA_) and deployment (PUBLIC_) variable formats
 */
const WebEnvSchema = z
    .object({
        // Node Environment
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

        // API Configuration - Support both formats
        HOSPEDA_API_URL: z.string().url('Must be a valid API URL').optional(),
        PUBLIC_API_URL: z.string().url('Must be a valid API URL').optional(),

        // Site Configuration - Support both formats
        HOSPEDA_SITE_URL: z.string().url('Must be a valid site URL').optional(),
        PUBLIC_SITE_URL: z.string().url('Must be a valid site URL').optional(),

        // Authentication (Clerk) - Support both formats
        HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: z
            .string()
            .min(1, 'Clerk publishable key is required')
            .optional(),
        PUBLIC_CLERK_PUBLISHABLE_KEY: z
            .string()
            .min(1, 'Clerk publishable key is required')
            .optional(),

        // Internationalization
        PUBLIC_DEFAULT_LOCALE: z.string().default('es'),
        PUBLIC_SUPPORTED_LOCALES: z.string().default('es,en,pt'),

        // Optional Services
        PUBLIC_SENTRY_DSN: z.string().optional(),

        // Development/Debug
        PUBLIC_DEBUG: z.coerce.boolean().default(false),
        PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(true)
    })
    .refine((data) => data.HOSPEDA_API_URL || data.PUBLIC_API_URL, {
        message: 'API_URL is required (either HOSPEDA_API_URL or PUBLIC_API_URL)',
        path: ['API_URL']
    })
    .refine((data) => data.HOSPEDA_SITE_URL || data.PUBLIC_SITE_URL, {
        message: 'SITE_URL is required (either HOSPEDA_SITE_URL or PUBLIC_SITE_URL)',
        path: ['SITE_URL']
    })
    .refine(
        (data) => data.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY || data.PUBLIC_CLERK_PUBLISHABLE_KEY,
        {
            message:
                'CLERK_PUBLISHABLE_KEY is required (either HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY or PUBLIC_CLERK_PUBLISHABLE_KEY)',
            path: ['CLERK_PUBLISHABLE_KEY']
        }
    );

/**
 * Helper to safely access process.env with defaults during module initialization
 */
const safeEnv = {
    get: (key: string, defaultValue = ''): string => process.env[key] || defaultValue,
    getBoolean: (key: string, defaultValue = false): boolean => {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        return value === 'true';
    }
};

/**
 * Get the API URL from either format
 */
export const getApiUrl = (): string => {
    return safeEnv.get('HOSPEDA_API_URL') || safeEnv.get('PUBLIC_API_URL', 'http://localhost:3001');
};

/**
 * Get the site URL from either format
 */
export const getSiteUrl = (): string => {
    return (
        safeEnv.get('HOSPEDA_SITE_URL') || safeEnv.get('PUBLIC_SITE_URL', 'http://localhost:4321')
    );
};

/**
 * Get the Clerk publishable key from either format
 */
export const getClerkPublishableKey = (): string => {
    return (
        safeEnv.get('HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY') ||
        safeEnv.get('PUBLIC_CLERK_PUBLISHABLE_KEY', '')
    );
};

/**
 * Get supported locales as array
 */
export const getSupportedLocales = (): string[] => {
    const locales = safeEnv.get('PUBLIC_SUPPORTED_LOCALES', 'es,en,pt');
    return locales.split(',').map((locale) => locale.trim());
};

/**
 * Creates the Web App environment validation function.
 * @remarks
 * Uses the WebEnvSchema to validate environment variables at startup.
 * @see WebEnvSchema
 * @see createStartupValidator
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod schema compatibility with createStartupValidator
const _validateWebEnv = createStartupValidator(WebEnvSchema as any, 'Web App');

/**
 * The validated Web App environment object.
 * @remarks
 * This object is populated after calling {@link validateWebEnv}.
 */
export let env: z.infer<typeof WebEnvSchema>;

/**
 * Validate and populate the environment object
 * Must be called before using the env object
 */
export const validateWebEnv = (): void => {
    env = _validateWebEnv() as z.infer<typeof WebEnvSchema>;
};

// Export the schema for testing
export { WebEnvSchema };
