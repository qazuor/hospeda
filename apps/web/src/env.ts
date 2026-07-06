/**
 * Environment variable validation schemas using Zod.
 * Validates that required variables are present at build/runtime.
 */

import type { z } from 'zod';
import { serverEnvBaseSchema } from './env-schema.js';

// `serverEnvBaseSchema` now lives in the sibling `env-schema.ts` file, kept
// separate purely for NAMING CONSISTENCY with the other three apps (this
// file was already a clean, zod-only module — see env-schema.ts's docblock).
// Re-exported here so every existing importer (notably the env-registry
// cross-validation test) keeps working unchanged.
export { serverEnvBaseSchema };

/**
 * Server-side environment variable schema with cross-field validation.
 *
 * The `.refine` chain enforces that at least one of the (HOSPEDA_*, PUBLIC_*)
 * url pairs is provided. The plain key set lives in {@link serverEnvBaseSchema}.
 */
export const serverEnvSchema = serverEnvBaseSchema
    .refine((data) => data.HOSPEDA_API_URL || data.PUBLIC_API_URL, {
        message: 'Either HOSPEDA_API_URL or PUBLIC_API_URL must be set',
        path: ['API_URL']
    })
    .refine((data) => data.HOSPEDA_SITE_URL || data.PUBLIC_SITE_URL, {
        message: 'Either HOSPEDA_SITE_URL or PUBLIC_SITE_URL must be set',
        path: ['SITE_URL']
    })
    // ADMIN_URL is always required (at least one of the HOSPEDA_/PUBLIC_ pair):
    // getAdminUrlOrThrow() crashes pages (PropertyCard, publicar/nueva) when absent.
    .refine((data) => data.HOSPEDA_ADMIN_URL || data.PUBLIC_ADMIN_URL, {
        message: 'Either HOSPEDA_ADMIN_URL or PUBLIC_ADMIN_URL must be set',
        path: ['ADMIN_URL']
    })
    // Production-only: monitoring/analytics must be configured in prod.
    .refine(
        (data) =>
            data.NODE_ENV !== 'production' ||
            (data.PUBLIC_SENTRY_DSN !== undefined && data.PUBLIC_SENTRY_DSN !== ''),
        {
            message: 'PUBLIC_SENTRY_DSN is required in production',
            path: ['PUBLIC_SENTRY_DSN']
        }
    )
    .refine(
        (data) =>
            data.NODE_ENV !== 'production' ||
            (data.PUBLIC_POSTHOG_KEY !== undefined && data.PUBLIC_POSTHOG_KEY !== ''),
        {
            message: 'PUBLIC_POSTHOG_KEY is required in production',
            path: ['PUBLIC_POSTHOG_KEY']
        }
    )
    // Required in production: the cache-revalidation endpoint authenticates with
    // this shared secret. Optional in dev/test (no CDN to purge) so getApiUrl()
    // and friends never throw when the Vite SSR module-runner lacks it (FU-1).
    .refine(
        (data) =>
            data.NODE_ENV !== 'production' ||
            (typeof data.HOSPEDA_REVALIDATION_SECRET === 'string' &&
                data.HOSPEDA_REVALIDATION_SECRET.length >= 32),
        {
            message: 'HOSPEDA_REVALIDATION_SECRET is required in production',
            path: ['HOSPEDA_REVALIDATION_SECRET']
        }
    );

/** Inferred TypeScript type for server environment variables. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server-side environment variables at startup.
 *
 * @returns Validated and typed server environment object
 * @throws {Error} If required environment variables are missing or invalid
 */
/**
 * Merge process.env with import.meta.env so that variables injected
 * by Vite's `define` (which only populate `import.meta.env`) are
 * available to the Zod schema regardless of the runtime context.
 */
function collectEnv(): Record<string, string | undefined> {
    const metaEnv =
        typeof import.meta !== 'undefined' && import.meta.env
            ? (import.meta.env as Record<string, string | undefined>)
            : {};

    // process.env is only available server-side; guard for browser bundles
    const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};

    // process.env takes precedence; import.meta.env fills the gaps
    return { ...metaEnv, ...procEnv };
}

export function validateWebEnv(): ServerEnv {
    const result = serverEnvSchema.safeParse(collectEnv());

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid web app environment configuration:\n${formatted}`);
    }

    return result.data;
}
