/**
 * Environment variable validation schemas using Zod.
 * Validates that required variables are present at build/runtime.
 */

import { z } from 'zod';

/**
 * Base shape of the web app server-side environment schema.
 *
 * Exported separately from {@link serverEnvSchema} so consumers (notably the
 * env-registry cross-validation test) can enumerate `.shape` keys directly,
 * which is not possible on the wrapped `ZodEffects` returned by `.refine(...)`.
 *
 * Add new env vars HERE; the `.refine` blocks in {@link serverEnvSchema} are
 * reserved for cross-field validation.
 */
export const serverEnvBaseSchema = z.object({
    HOSPEDA_API_URL: z.url().optional(),
    PUBLIC_API_URL: z.url().optional(),
    HOSPEDA_SITE_URL: z.url().optional(),
    PUBLIC_SITE_URL: z.url().optional(),
    HOSPEDA_BETTER_AUTH_URL: z.url().optional(),
    HOSPEDA_ADMIN_URL: z.url().optional(),
    PUBLIC_ADMIN_URL: z.url().optional(),
    HOSPEDA_REVALIDATION_SECRET: z.string().min(32).optional(),
    PUBLIC_SENTRY_DSN: z.url().optional(),
    PUBLIC_SENTRY_RELEASE: z.string().optional(),
    /**
     * Free-text environment tag applied to all Sentry events from the web app
     * (SSR and browser). Takes precedence over `import.meta.env.MODE` in the
     * Sentry init. Required to separate staging from production in the Sentry
     * dashboard — without it, Astro production builds always emit MODE=production
     * regardless of which deployment they came from.
     */
    PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
    PUBLIC_VERSION: z.string().optional(),
    /**
     * Kill switch for the feedback FAB widget in the web app.
     * Defaults to false so local/dev environments are unaffected.
     * Set to 'true' in preview and production to show the FAB.
     */
    PUBLIC_FEEDBACK_ENABLED: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /**
     * WhatsApp broadcast channel invite URL. Used by the web WhatsAppCTA
     * island (SPEC-101 T-101-24). When unset the CTA block is hidden.
     */
    PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL: z.url().optional(),
    /**
     * Comma-separated list of hostnames that must receive a restrictive
     * `Disallow: /` robots policy and `X-Robots-Tag: noindex, nofollow`
     * header. Used by middleware.ts and pages/robots.txt.ts to keep
     * staging hostnames out of search engines. Defaults to
     * `staging.hospeda.com.ar` via parseNoindexHosts() when unset.
     */
    HOSPEDA_NOINDEX_HOSTS: z.string().optional(),
    /**
     * Opt-in flag for client-side console logging in non-dev builds.
     * Read by isLoggingEnabled() in src/lib/env.ts. Dev builds always
     * log regardless of this flag.
     */
    PUBLIC_ENABLE_LOGGING: z.string().optional(),
    /**
     * PostHog Cloud project API key for the web app (SPEC-140). Public by
     * design — ships in the browser bundle. Leave unset to disable PostHog
     * init (no events sent, no cookies set, no network requests). Per-env
     * values come from Coolify (one project key per staging/prod).
     */
    PUBLIC_POSTHOG_KEY: z.string().optional(),
    /**
     * PostHog ingestion endpoint for the web app (SPEC-140). Defaults to
     * the US Cloud region in posthog-client.ts when unset. Override only
     * if migrating to EU Cloud or self-hosted PostHog.
     */
    PUBLIC_POSTHOG_HOST: z.url().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

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
    });

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
        throw new Error(`Invalid web2 app environment configuration:\n${formatted}`);
    }

    return result.data;
}
