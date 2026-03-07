/**
 * Environment configuration with validation for Admin App
 * Uses Zod for validation and import.meta.env for accessing variables
 *
 * Note: Vite automatically loads .env files, so we don't need dotenv here
 */
import { adminLogger } from '@/utils/logger';
import { z } from 'zod';

/**
 * Schema for Admin App environment variables
 * Validates VITE_ prefixed variables that are available in the browser
 */
const AdminEnvSchema = z.object({
    // API Configuration
    VITE_API_URL: z.string().url().describe('API base URL'),

    // Authentication
    VITE_BETTER_AUTH_URL: z.string().min(1).describe('Better Auth URL for authentication'),

    // App Configuration
    VITE_APP_NAME: z.string().default('Hospeda Admin').describe('Application name'),
    VITE_APP_VERSION: z.string().default('1.0.0').describe('Application version'),
    VITE_APP_DESCRIPTION: z
        .string()
        .default('Admin panel for Hospeda platform')
        .describe('Application description'),

    // Feature Flags
    VITE_ENABLE_DEVTOOLS: z
        .string()
        .default('false')
        .transform((val) => val === 'true')
        .describe('Enable React DevTools'),
    VITE_ENABLE_QUERY_DEVTOOLS: z
        .string()
        .default('false')
        .transform((val) => val === 'true')
        .describe('Enable TanStack Query DevTools'),
    VITE_ENABLE_ROUTER_DEVTOOLS: z
        .string()
        .default('false')
        .transform((val) => val === 'true')
        .describe('Enable TanStack Router DevTools'),

    // UI Configuration
    VITE_DEFAULT_PAGE_SIZE: z
        .string()
        .default('25')
        .transform((val) => Number.parseInt(val, 10))
        .describe('Default pagination size'),
    VITE_MAX_PAGE_SIZE: z
        .string()
        .default('100')
        .transform((val) => Number.parseInt(val, 10))
        .describe('Maximum pagination size'),

    // Monitoring
    VITE_SENTRY_DSN: z
        .string()
        .url()
        .optional()
        .describe('Sentry DSN for error tracking (production only)'),
    VITE_SENTRY_RELEASE: z.string().optional().describe('Sentry release identifier'),
    VITE_SENTRY_PROJECT: z.string().optional().describe('Sentry project slug'),

    // Locale Configuration
    VITE_SUPPORTED_LOCALES: z
        .string()
        .default('es,en')
        .describe('Comma-separated list of supported locales'),
    VITE_DEFAULT_LOCALE: z.string().default('es').describe('Default locale for the admin app'),

    // Debug / Developer Flags
    VITE_DEBUG_LAZY_SECTIONS: z.coerce
        .boolean()
        .default(false)
        .describe('Enable debug logging for lazy-loaded sections'),
    VITE_DEBUG_ACTOR_ID: z.string().optional().describe('Override actor ID for debugging purposes'),
    VITE_ENABLE_LOGGING: z.coerce
        .boolean()
        .default(false)
        .describe('Enable verbose client-side logging'),

    // Development
    NODE_ENV: z
        .string()
        .default('development')
        .refine((val) => ['development', 'production', 'test'].includes(val), {
            message: 'NODE_ENV must be development, production, or test'
        })
        .describe('Node environment'),
    DEV: z.boolean().optional().describe('Vite development mode flag'),
    PROD: z.boolean().optional().describe('Vite production mode flag')
});

/**
 * Type for validated environment variables
 */
export type AdminEnv = z.infer<typeof AdminEnvSchema>;

/**
 * Helper to safely access import.meta.env with defaults
 * For Vite apps, environment variables are available via import.meta.env
 */
const safeEnv = {
    get: (
        key: string,
        defaultValue?: string | boolean | number
    ): string | boolean | number | undefined => {
        const value = import.meta.env[key];
        return value !== undefined ? value : defaultValue;
    },
    getBoolean: (key: string, defaultValue = false): boolean => {
        const value = import.meta.env[key];
        if (value === undefined) return defaultValue;
        return value === 'true' || value === true;
    },
    getNumber: (key: string, defaultValue = 0): number => {
        const value = import.meta.env[key];
        if (value === undefined) return defaultValue;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }
};

/**
 * Validate all required environment variables for the Admin App
 * Should be called at application startup
 */
export const validateAdminEnv = (): AdminEnv => {
    try {
        // Create env object from import.meta.env
        const envData = {
            VITE_API_URL: import.meta.env.VITE_API_URL,
            VITE_BETTER_AUTH_URL: import.meta.env.VITE_BETTER_AUTH_URL,
            VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'Hospeda Admin',
            VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
            VITE_APP_DESCRIPTION:
                import.meta.env.VITE_APP_DESCRIPTION || 'Admin panel for Hospeda platform',
            VITE_ENABLE_DEVTOOLS: import.meta.env.VITE_ENABLE_DEVTOOLS || 'false',
            VITE_ENABLE_QUERY_DEVTOOLS: import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS || 'false',
            VITE_ENABLE_ROUTER_DEVTOOLS: import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS || 'false',
            VITE_DEFAULT_PAGE_SIZE: import.meta.env.VITE_DEFAULT_PAGE_SIZE || '25',
            VITE_MAX_PAGE_SIZE: import.meta.env.VITE_MAX_PAGE_SIZE || '100',
            VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
            VITE_SENTRY_RELEASE: import.meta.env.VITE_SENTRY_RELEASE,
            VITE_SENTRY_PROJECT: import.meta.env.VITE_SENTRY_PROJECT,
            VITE_SUPPORTED_LOCALES: import.meta.env.VITE_SUPPORTED_LOCALES || 'es,en',
            VITE_DEFAULT_LOCALE: import.meta.env.VITE_DEFAULT_LOCALE || 'es',
            VITE_DEBUG_LAZY_SECTIONS: import.meta.env.VITE_DEBUG_LAZY_SECTIONS,
            VITE_DEBUG_ACTOR_ID: import.meta.env.VITE_DEBUG_ACTOR_ID,
            VITE_ENABLE_LOGGING: import.meta.env.VITE_ENABLE_LOGGING,
            NODE_ENV: import.meta.env.NODE_ENV || 'development',
            DEV: import.meta.env.DEV,
            PROD: import.meta.env.PROD
        };

        return AdminEnvSchema.parse(envData);
    } catch (error) {
        adminLogger.error('❌ Admin App environment validation FAILED');
        adminLogger.error(error instanceof Error ? error.message : String(error));
        throw new Error('Environment validation failed for Admin App');
    }
};

/**
 * Get the API base URL
 */
export const getApiUrl = (): string => {
    return safeEnv.get('VITE_API_URL') as string;
};

/**
 * Get Better Auth URL for authentication
 */
export const getBetterAuthUrl = (): string => {
    return safeEnv.get('VITE_BETTER_AUTH_URL') as string;
};

/**
 * Get admin app configuration
 */
export const getAdminConfig = () => {
    return {
        name: safeEnv.get('VITE_APP_NAME', 'Hospeda Admin'),
        version: safeEnv.get('VITE_APP_VERSION', '1.0.0'),
        description: safeEnv.get('VITE_APP_DESCRIPTION', 'Admin panel for Hospeda platform')
    };
};

/**
 * Get feature flags configuration
 */
export const getFeatureFlags = () => {
    return {
        enableDevtools: safeEnv.get('VITE_ENABLE_DEVTOOLS', false),
        enableQueryDevtools: safeEnv.get('VITE_ENABLE_QUERY_DEVTOOLS', false),
        enableRouterDevtools: safeEnv.get('VITE_ENABLE_ROUTER_DEVTOOLS', false)
    };
};

/**
 * Get pagination configuration
 */
export const getPaginationConfig = () => {
    return {
        defaultPageSize: safeEnv.get('VITE_DEFAULT_PAGE_SIZE', 25),
        maxPageSize: safeEnv.get('VITE_MAX_PAGE_SIZE', 100)
    };
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
    return safeEnv.get('NODE_ENV', 'development') === 'development';
};

/**
 * Check if running in production mode
 */
export const isProduction = (): boolean => {
    return safeEnv.get('NODE_ENV', 'development') === 'production';
};

/**
 * Check if running in test mode
 */
export const isTest = (): boolean => {
    return safeEnv.get('NODE_ENV', 'development') === 'test';
};

/**
 * Get Sentry DSN for error tracking (optional, only used in production)
 */
export const getSentryDsn = (): string | undefined => {
    return safeEnv.get('VITE_SENTRY_DSN') as string | undefined;
};

// Export the schema for testing
export { AdminEnvSchema };
