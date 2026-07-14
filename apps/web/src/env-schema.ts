/**
 * @file env-schema.ts
 * @description Pure, zero-side-effect Zod schema for the web app server-side environment.
 *
 * This file MUST import ONLY from `zod`. `apps/web/src/env.ts` was already
 * clean (no dotenv, no logger, no app-alias imports at module load), so this
 * file exists purely for NAMING CONSISTENCY with the other three apps
 * (`apps/api`, `apps/admin`, `apps/mobile`), whose `env.ts` files DID need a
 * pure-schema extraction to be safely importable from a plain root-level
 * script (HOS-79 — Env Var Management Hardening).
 *
 * `env.ts` re-exports {@link serverEnvBaseSchema} from here.
 *
 * A guard test (`test/lib/env-schema-purity.guard.test.ts`) asserts this file
 * never acquires a non-zod import.
 */
import { z } from 'zod';

/**
 * Base shape of the web app server-side environment schema.
 *
 * Exported separately from the `.refine`-wrapped `serverEnvSchema` (defined
 * in `env.ts`) so consumers (notably the env-registry cross-validation test
 * and the HOS-79 registry-JSON generator) can enumerate `.shape` keys
 * directly, which is not possible on the wrapped `ZodEffects` returned by
 * `.refine(...)`.
 *
 * Add new env vars HERE; the `.refine` blocks in `serverEnvSchema` (`env.ts`)
 * are reserved for cross-field validation.
 */
export const serverEnvBaseSchema = z.object({
    HOSPEDA_API_URL: z.url().optional(),
    PUBLIC_API_URL: z.url().optional(),
    /**
     * Internal API base URL for server-to-server SSR fetches (HOS-103).
     *
     * When set, the API client uses it as the base URL for GET requests issued
     * during SSR, INSTEAD of the public `PUBLIC_API_URL`. This keeps SSR traffic
     * on the internal network (no Cloudflare round-trip) and, paired with
     * `HOSPEDA_INTERNAL_REQUEST_SECRET`, lets the API exempt it from the public
     * per-IP rate limit (SSR traffic from all visitors otherwise shares one
     * egress IP → one bucket). Server-only, never shipped to the browser; browser
     * calls always use the public URL. Leave unset in local dev (SSR hits the
     * same localhost API as the browser).
     */
    HOSPEDA_INTERNAL_API_URL: z.url().optional(),
    /**
     * Shared secret sent as the `X-Internal-Request` header on SSR fetches
     * (HOS-103). MUST match the API's `HOSPEDA_INTERNAL_REQUEST_SECRET`. The API
     * skips the public rate limit only when this header matches, so SSR traffic
     * is not counted against the anonymous per-IP bucket. Fails safe: when unset
     * on either side, the header is not sent / not trusted and SSR traffic simply
     * counts normally (no bypass, no security hole). Server-only — the header is
     * added only during SSR (`import.meta.env.SSR`) and this var carries no
     * PUBLIC_ prefix, so the secret never reaches the browser bundle.
     */
    HOSPEDA_INTERNAL_REQUEST_SECRET: z.string().min(32).optional(),
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
     * Environment tag applied to all Sentry events from the web app
     * (SSR and browser). Takes precedence over `import.meta.env.MODE` in the
     * Sentry init. Required to separate staging from production in the Sentry
     * dashboard — without it, Astro production builds always emit MODE=production
     * regardless of which deployment they came from.
     *
     * Only `production` and `staging` are ever set explicitly (see
     * `docs/runbooks/sentry-setup.md` "Values by Environment" table). Local
     * dev never sets this var, so `development`/`test` are intentionally NOT
     * valid explicit values here.
     */
    PUBLIC_SENTRY_ENVIRONMENT: z.enum(['production', 'staging']).optional(),
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
    /**
     * CSP violation report endpoint for a DEDICATED Sentry project
     * (`hospeda-csp`), separate from the app's own error-tracking project
     * (`PUBLIC_SENTRY_DSN`). Browser-emitted CSP violation reports are noisy
     * and unrelated to application errors; routing them to their own project
     * keeps the app's Sentry issue stream clean. This is the Sentry Security
     * Header endpoint URL (`https://<host>/api/<project_id>/security/?sentry_key=<key>`),
     * NOT a DSN — copy it directly from the `hospeda-csp` project settings.
     * When unset, the web CSP `report-uri` directive falls back to the app's
     * own DSN-derived report endpoint (previous behavior) so CSP enforcement
     * is never affected by this var being unset.
     */
    PUBLIC_SENTRY_CSP_REPORT_URI: z.url().optional(),
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
     * Cloudflare Turnstile site key for the invisible feedback bot-detection widget (SPEC-301).
     * Public by design — ships in the browser bundle. When unset, the widget is not rendered.
     */
    PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
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
