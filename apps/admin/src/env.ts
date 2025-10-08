/**
 * Environment configuration with validation for Admin App
 * Uses Zod for validation and import.meta.env for accessing variables
 *
 * Note: Vite automatically loads .env files, so we don't need dotenv here
 */
import { z } from 'zod';

/**
 * Schema for Admin App environment variables
 * Validates VITE_ prefixed variables that are available in the browser
 */
const AdminEnvSchema = z.object({
    // API Configuration
    VITE_API_URL: z.string().url().describe('API base URL'),

    // Authentication
    VITE_CLERK_PUBLISHABLE_KEY: z
        .string()
        .min(1)
        .describe('Clerk publishable key for authentication'),

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
            VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
            VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'Hospeda Admin',
            VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
            VITE_APP_DESCRIPTION:
                import.meta.env.VITE_APP_DESCRIPTION || 'Admin panel for Hospeda platform',
            VITE_ENABLE_DEVTOOLS: import.meta.env.VITE_ENABLE_DEVTOOLS || 'false',
            VITE_ENABLE_QUERY_DEVTOOLS: import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS || 'false',
            VITE_ENABLE_ROUTER_DEVTOOLS: import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS || 'false',
            VITE_DEFAULT_PAGE_SIZE: import.meta.env.VITE_DEFAULT_PAGE_SIZE || '25',
            VITE_MAX_PAGE_SIZE: import.meta.env.VITE_MAX_PAGE_SIZE || '100',
            NODE_ENV: import.meta.env.NODE_ENV || 'development',
            DEV: import.meta.env.DEV,
            PROD: import.meta.env.PROD
        };

        return AdminEnvSchema.parse(envData);
    } catch (error) {
        console.error('❌ Admin App environment validation FAILED');
        console.error(error instanceof Error ? error.message : String(error));
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
 * Get Clerk publishable key for authentication
 */
export const getClerkPublishableKey = (): string => {
    return safeEnv.get('VITE_CLERK_PUBLISHABLE_KEY') as string;
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

// Export the schema for testing
export { AdminEnvSchema };
