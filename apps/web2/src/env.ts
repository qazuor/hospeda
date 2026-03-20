/**
 * Environment variable validation schemas using Zod.
 * Validates that required variables are present at build/runtime.
 */

import { z } from 'zod';

/**
 * Server-side environment variable schema.
 */
export const serverEnvSchema = z
    .object({
        HOSPEDA_API_URL: z.string().url().optional(),
        PUBLIC_API_URL: z.string().url().optional(),
        HOSPEDA_SITE_URL: z.string().url().optional(),
        PUBLIC_SITE_URL: z.string().url().optional(),
        HOSPEDA_BETTER_AUTH_URL: z.string().url().optional(),
        HOSPEDA_REVALIDATION_SECRET: z.string().min(32).optional(),
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

/** Inferred TypeScript type for server environment variables. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server-side environment variables at startup.
 *
 * @returns Validated and typed server environment object
 * @throws {Error} If required environment variables are missing or invalid
 */
export function validateWebEnv(): ServerEnv {
    const result = serverEnvSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid web2 app environment configuration:\n${formatted}`);
    }

    return result.data;
}
