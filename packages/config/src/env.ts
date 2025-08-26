import type { Plugin } from 'vite';
import { z } from 'zod';

/**
 * Mapping of public environment variable names to their source names
 * @example { PUBLIC_API_URL: 'HOSPEDA_API_URL' }
 */
export type EnvMapping = Record<string, string>;

/**
 * Environment validation error with detailed information
 */
export class EnvValidationError extends Error {
    constructor(
        public readonly errors: z.ZodError,
        public readonly context: string
    ) {
        const errorMessages = errors.errors
            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');

        super(`❌ Environment validation failed for ${context}:\n${errorMessages}`);
        this.name = 'EnvValidationError';
    }
}

/**
 * Validates environment variables against a Zod schema
 * @param schema - Zod schema to validate against
 * @param context - Context name for error messages (e.g., 'API', 'Admin App')
 * @returns Validated environment object
 * @throws EnvValidationError if validation fails
 */
export function validateEnv<T>(schema: z.ZodSchema<T>, context: string): T {
    try {
        // Log some debug info about what we're validating
        const envKeys = Object.keys(process.env).filter(
            (key) =>
                key.startsWith('HOSPEDA_') ||
                key.startsWith('API_') ||
                key.startsWith('TODO_LINEAR_') ||
                key.startsWith('DB_') ||
                key === 'NODE_ENV'
        );

        if (envKeys.length === 0) {
            console.warn(`⚠️  No relevant environment variables found for ${context}`);
            console.warn(
                '🔍 Looking for variables starting with: HOSPEDA_, API_, TODO_LINEAR_, DB_, NODE_ENV'
            );
        } else {
            // Found relevant environment variables
        }

        const result = schema.parse(process.env);
        return result;
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Log additional debug info on validation failure
            console.error(`\n🐛 Debug info for ${context}:`);
            console.error(`📂 Current working directory: ${process.cwd()}`);
            console.error(`🔍 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
            console.error(`📝 Total env vars: ${Object.keys(process.env).length}`);

            throw new EnvValidationError(error, context);
        }
        throw error;
    }
}

/**
 * Creates a startup validator that checks environment variables
 * @param schema - Zod schema to validate against
 * @param context - Context name for error messages
 * @returns Function that validates environment and exits process on failure
 */
export function createStartupValidator<T>(schema: z.ZodSchema<T>, context: string) {
    return (): T => {
        // Validate environment variables

        try {
            const env = validateEnv(schema, context);

            // Environment validation passed

            return env;
        } catch (error) {
            console.error(`❌ ${context} environment validation FAILED`);
            console.error(error instanceof Error ? error.message : String(error));
            console.error(
                '\n💡 Check your .env.local file and ensure all required variables are set.'
            );
            console.error(
                `📂 Expected .env.local location: ${process.cwd()}/.env.local or project root`
            );
            process.exit(1);
        }
    };
}

/**
 * Get an environment variable with optional fallback
 * @param name - Environment variable name
 * @param fallback - Optional fallback value
 * @returns Environment variable value
 * @throws Error if variable is missing and no fallback provided
 */
export function getEnv(name: string, fallback?: string): string {
    const value = process.env[name];
    if (value == null) {
        if (fallback !== undefined) return fallback;
        throw new Error(`[config] Missing environment variable: ${name}`);
    }
    return value;
}

/**
 * Get an environment variable as boolean
 * @param name - Environment variable name
 * @param fallback - Optional fallback value
 * @returns Boolean value (true for 'true', '1', 'yes', 'on')
 */
export function getEnvBoolean(name: string, fallback = false): boolean {
    const value = process.env[name];
    if (value == null) return fallback;
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Get an environment variable as number
 * @param name - Environment variable name
 * @param fallback - Optional fallback value
 * @returns Numeric value
 * @throws Error if value is not a valid number
 */
export function getEnvNumber(name: string, fallback?: number): number {
    const value = process.env[name];
    if (value == null) {
        if (fallback !== undefined) return fallback;
        throw new Error(`[config] Missing environment variable: ${name}`);
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
        throw new Error(`[config] Environment variable ${name} is not a valid number: ${value}`);
    }
    return num;
}

/**
 * Vite plugin that exposes server environment variables as client-side variables
 * with validation support
 *
 * This plugin maps server-side environment variables (e.g., HOSPEDA_API_URL)
 * to client-side variables with appropriate prefixes:
 * - import.meta.env.PUBLIC_* (for Astro)
 * - import.meta.env.VITE_* (for Vite apps like TanStack Start)
 *
 * @param mapping - Object mapping public variable names to source variable names
 * @param options - Optional configuration
 * @returns Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { exposeSharedEnv } from '@repo/config';
 *
 * export default defineConfig({
 *   plugins: [
 *     exposeSharedEnv({
 *       PUBLIC_API_URL: 'HOSPEDA_API_URL',
 *       PUBLIC_CLERK_PUBLISHABLE_KEY: 'HOSPEDA_CLERK_PUBLISHABLE_KEY'
 *     }, {
 *       validate: true,
 *       context: 'Admin App'
 *     })
 *   ]
 * });
 * ```
 */
export function exposeSharedEnv(
    mapping: EnvMapping,
    options: { validate?: boolean; context?: string; schema?: z.ZodSchema } = {}
): Plugin {
    return {
        name: 'expose-shared-env',
        enforce: 'pre', // Execute before other plugins
        config(config, { command: _ }) {
            const define: Record<string, string> = {};
            const { validate = false, context = 'Client App', schema } = options;

            // Load environment variables from root .env.local if needed
            // This ensures variables are available in the plugin context

            // Validate environment if requested
            if (validate && schema) {
                try {
                    schema.parse(process.env);
                    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
                    console.log(`✅ ${context} environment validation passed`);
                } catch (error) {
                    if (error instanceof z.ZodError) {
                        const errorMessages = error.errors
                            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
                            .join('\n');
                        console.error(
                            `❌ Environment validation failed for ${context}:\n${errorMessages}`
                        );
                        console.error(
                            '\n💡 Check your .env.local file and ensure all required variables are set.'
                        );
                        process.exit(1);
                    }
                    throw error;
                }
            }

            for (const [publicKey, sourceKey] of Object.entries(mapping)) {
                const value = process.env[sourceKey] ?? '';

                // For Astro (PUBLIC_ prefix)
                define[`import.meta.env.${publicKey}`] = JSON.stringify(value);

                // For Vite apps (VITE_ prefix) - remove PUBLIC_ prefix if present
                const viteKey = publicKey.replace(/^PUBLIC_/, '');
                const viteEnvKey = `import.meta.env.VITE_${viteKey}`;
                define[viteEnvKey] = JSON.stringify(value);

                // Map environment variables to client-side format
            }

            // Merge with existing define
            if (!config.define) config.define = {};
            Object.assign(config.define, define);

            // Plugin configuration completed

            return config;
        }
    };
}

/**
 * Predefined environment variable mappings for common use cases
 */
export const commonEnvMappings = {
    /**
     * Basic API and authentication configuration
     */
    basic: {
        PUBLIC_API_URL: 'HOSPEDA_API_URL',
        PUBLIC_CLERK_PUBLISHABLE_KEY: 'HOSPEDA_CLERK_PUBLISHABLE_KEY'
    } as EnvMapping,

    /**
     * Extended configuration including debugging and optional features
     */
    extended: {
        PUBLIC_API_URL: 'HOSPEDA_API_URL',
        PUBLIC_CLERK_PUBLISHABLE_KEY: 'HOSPEDA_CLERK_PUBLISHABLE_KEY',
        PUBLIC_DEBUG_ACTOR_ID: 'HOSPEDA_DEBUG_ACTOR_ID',
        PUBLIC_SUPPORTED_LOCALES: 'HOSPEDA_SUPPORTED_LOCALES',
        PUBLIC_DEFAULT_LOCALE: 'HOSPEDA_DEFAULT_LOCALE'
    } as EnvMapping
} as const;

/**
 * Predefined Zod schemas for common environment validation patterns
 */
export const commonEnvSchemas = {
    /**
     * Basic server configuration (Node.js apps)
     */
    server: z.object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        HOSPEDA_API_URL: z.string().url('Must be a valid URL'),
        HOSPEDA_DATABASE_URL: z.string().min(1, 'Database URL is required')
    }),

    /**
     * Client app configuration (Astro/Vite apps)
     */
    client: z.object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        HOSPEDA_API_URL: z.string().url('Must be a valid URL'),
        HOSPEDA_SITE_URL: z.string().url('Must be a valid URL'),
        HOSPEDA_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk publishable key is required')
    }),

    /**
     * Authentication configuration
     */
    auth: z.object({
        HOSPEDA_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk publishable key is required'),
        CLERK_SECRET_KEY: z.string().min(1, 'Clerk secret key is required').optional(),
        CLERK_WEBHOOK_SECRET: z.string().optional()
    }),

    /**
     * Internationalization configuration
     */
    i18n: z.object({
        HOSPEDA_SUPPORTED_LOCALES: z.string().default('en,es'),
        HOSPEDA_DEFAULT_LOCALE: z.string().default('en')
    }),

    /**
     * Logging configuration
     */
    logging: z.object({
        LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),
        LOG_INCLUDE_TIMESTAMPS: z.coerce.boolean().default(true),
        LOG_USE_COLORS: z.coerce.boolean().default(true)
    })
} as const;
