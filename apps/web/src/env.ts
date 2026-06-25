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
    // Optional in the base schema so that ubiquitous server accessors (getApiUrl,
    // getSiteUrl, …) do not throw when it is absent. It is only consumed by the
    // Cloudflare cache-revalidation endpoint, which has no effect in local dev
    // (no CDN to purge). Required in production via the `.refine` below — mirrors
    // the PUBLIC_SENTRY_DSN / PUBLIC_POSTHOG_KEY production-only pattern. This is
    // the FU-1 fix: under `astro dev` the Vite SSR module-runner runs with an
    // isolated process.env that never receives this server-only var, so making it
    // hard-required broke every web write flow that calls getApiUrl().
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
    /**
     * First-party tunnel path for the Sentry browser SDK (SPEC-181 follow-up).
     * When set (e.g. `/api/event`), the SDK POSTs all envelopes to this
     * same-origin path instead of directly to *.sentry.io, defeating ad-blockers
     * (uBlock `||sentry.io^$3p`). A Cloudflare Worker bound to that path
     * (infra/cloudflare/sentry-tunnel/) parses the DSN and forwards to Sentry.
     * Setting this ALSO drops `https://*.sentry.io` from the web CSP connect-src
     * (the tunnel is same-origin). The Worker MUST be live BEFORE this is set —
     * see infra/cloudflare/sentry-tunnel/README.md for the deploy order. Leave
     * unset to report directly to Sentry (default).
     *
     * Validated as an absolute path (or empty = disabled) so a malformed value
     * fails fast at startup instead of silently dropping all browser error
     * reports: a non-path truthy value (e.g. `'true'`, `' '`) would make the SDK
     * POST envelopes to a 404 path AND drop `*.sentry.io` from the CSP, leaving
     * no fallback. Must start with `/` (relative, same-origin tunnel).
     */
    PUBLIC_SENTRY_TUNNEL: z
        .string()
        .regex(/^(\/[\w/-]+)?$/, 'PUBLIC_SENTRY_TUNNEL must be an absolute path like /api/event')
        .optional(),
    /**
     * Sentry tracing sample rate for the web app (0.0–1.0).
     * Set to 1.0 on staging to avoid starving CWV data at 10% sampling.
     * Defaults to 0.1 if unset.
     */
    PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
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
