import { z } from 'zod';

/**
 * Server-side environment variable schema.
 * Validates that required variables are present at build/runtime.
 *
 * This schema ensures that either the monorepo variables (HOSPEDA_*)
 * or the deployment/public variables (PUBLIC_*) are set for API and Site URLs.
 */
const serverEnvSchema = z
    .object({
        HOSPEDA_API_URL: z.string().url().optional(),
        PUBLIC_API_URL: z.string().url().optional(),
        HOSPEDA_SITE_URL: z.string().url().optional(),
        PUBLIC_SITE_URL: z.string().url().optional(),
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
const clientEnvSchema = z.object({
    PUBLIC_API_URL: z.string().url(),
    PUBLIC_SITE_URL: z.string().url()
});

/**
 * Inferred TypeScript type for server environment variables.
 */
type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Inferred TypeScript type for client environment variables.
 */
type ClientEnv = z.infer<typeof clientEnvSchema>;

export { serverEnvSchema, clientEnvSchema };
export type { ServerEnv, ClientEnv };
