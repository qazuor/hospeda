/**
 * Environment variable validation schemas using Zod.
 * Validates that required variables are present at build/runtime.
 */

import { z } from 'zod';

/**
 * Server-side environment variable schema.
 * Validates that required variables are present at build/runtime.
 *
 * This schema ensures that either the monorepo variables (HOSPEDA_*)
 * or the deployment/public variables (PUBLIC_*) are set for API and Site URLs.
 */
export const serverEnvSchema = z
    .object({
        HOSPEDA_API_URL: z.string().url().optional(),
        PUBLIC_API_URL: z.string().url().optional(),
        HOSPEDA_SITE_URL: z.string().url().optional(),
        PUBLIC_SITE_URL: z.string().url().optional(),
        HOSPEDA_BETTER_AUTH_URL: z.string().url().optional(),
        PUBLIC_SENTRY_DSN: z.string().url().optional(),
        PUBLIC_SENTRY_RELEASE: z.string().optional(),
        PUBLIC_VERSION: z.string().optional(),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
    })
    .refine((data) => data.HOSPEDA_API_URL || data.PUBLIC_API_URL, {
        message: 'Either HOSPEDA_API_URL or PUBLIC_API_URL must be set',
        path: ['API_URL']
    })
    .refine((data) => data.HOSPEDA_SITE_URL || data.PUBLIC_SITE_URL, {
        message: 'Either HOSPEDA_SITE_URL or PUBLIC_SITE_URL must be set',
        path: ['SITE_URL']
    });

/**
 * Client-safe environment variable schema.
 * Only PUBLIC_ prefixed variables are accessible on the client.
 *
 * These variables are exposed to the browser and must not contain secrets.
 */
export const clientEnvSchema = z.object({
    PUBLIC_API_URL: z.string().url(),
    PUBLIC_SITE_URL: z.string().url(),
    PUBLIC_SENTRY_DSN: z.string().url().optional(),
    PUBLIC_SENTRY_RELEASE: z.string().optional(),
    PUBLIC_VERSION: z.string().optional()
});

/** Inferred TypeScript type for server environment variables. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Inferred TypeScript type for client environment variables. */
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates server-side environment variables at startup.
 *
 * Should be called once during server initialization to ensure all required
 * environment variables are present and valid. Throws if validation fails
 * so that misconfigured deployments fail fast with a clear error message.
 *
 * @returns Validated and typed server environment object
 *
 * @throws {Error} If required environment variables are missing or invalid
 *
 * @example
 * ```ts
 * // In astro.config.mjs or server entry point
 * import { validateWebEnv } from './src/env';
 * validateWebEnv();
 * ```
 */
export function validateWebEnv(): ServerEnv {
    const result = serverEnvSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid web app environment configuration:\n${formatted}`);
    }

    return result.data;
}
