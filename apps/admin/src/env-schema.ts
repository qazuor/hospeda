/**
 * @file env-schema.ts
 * @description Pure, zero-side-effect Zod schema for the Admin app environment.
 *
 * This file MUST import ONLY from `zod`. No `@/utils/logger` (which resolves
 * via the Vite-only `@/` path alias and is unresolvable outside Vite), no
 * other app or package imports. That purity is what lets a plain root-level
 * script (`tsx`, no Vite bundler) safely `import` the real Admin env schema
 * for introspection (HOS-79 — Env Var Management Hardening).
 *
 * `env.ts` re-exports {@link AdminEnvSchema} from here and is responsible for
 * everything with side effects: logging validation failures via
 * `adminLogger`, reading `import.meta.env`, and the lazy singleton.
 *
 * A guard test (`test/env-schema-purity.guard.test.ts`) asserts this file
 * never re-acquires a non-zod import.
 */
import { z } from 'zod';

/**
 * Detects the CI build placeholder URL.
 *
 * CI runs without repository secrets (most visibly Dependabot PRs), so the
 * workflow falls back to `https://example.invalid` for the URL env vars to let
 * the admin build's URL validation pass — see `.github/workflows/ci.yml` and
 * SPEC-219. The `.invalid` TLD is reserved by RFC 2606 and never resolves, so
 * it is a safe, recognizable marker that must NEVER reach a real/deploy build.
 *
 * @param value - The candidate URL string.
 * @returns `true` when the URL host is under the reserved `.invalid` TLD.
 */
const isPlaceholderUrl = (value: string): boolean => {
    try {
        const { hostname } = new URL(value);
        return hostname === 'invalid' || hostname.endsWith('.invalid');
    } catch {
        return false;
    }
};

/**
 * A required, syntactically-valid URL that additionally rejects the CI
 * placeholder (`*.invalid`) unless `ALLOW_PLACEHOLDER_ENV_URLS` is explicitly
 * set to `'true'`. Only the CI Build step sets that flag (SPEC-219 T-002), so a
 * production/deploy build that is misconfigured with a placeholder URL fails
 * loudly instead of silently shipping a non-functional value (SPEC-219 T-006).
 *
 * The flag is read inside the refinement (not at module scope) so it reflects
 * the environment at validation time.
 *
 * NOTE: `process` is only defined in Node contexts (build / SSR). Vite does NOT
 * polyfill `process` in the browser bundle, so reading `process.env.*` in a
 * hydrated client throws `ReferenceError: process is not defined`. The
 * `typeof process !== 'undefined'` guard avoids that: in the browser it
 * short-circuits, leaving the flag seen as absent and therefore always
 * rejecting a placeholder — which is the intended behavior:
 * `ALLOW_PLACEHOLDER_ENV_URLS` is a build-time-only CI signal and must never
 * relax the guard in a running browser. The build-time counterpart of this
 * guard lives in `vite.config.ts`.
 *
 * @param label - Field name, used in the rejection message.
 * @returns A Zod string schema enforcing the rules above.
 */
const requiredUrl = (label: string) =>
    z
        .string()
        .url()
        .refine(
            (value) =>
                (typeof process !== 'undefined' &&
                    process.env.ALLOW_PLACEHOLDER_ENV_URLS === 'true') ||
                !isPlaceholderUrl(value),
            {
                message: `${label} is a placeholder (.invalid) URL; a real URL is required outside CI builds`
            }
        );

/**
 * Schema for Admin App environment variables
 * Validates VITE_ prefixed variables that are available in the browser
 */
export const AdminEnvSchema = z.object({
    // API Configuration
    VITE_API_URL: requiredUrl('VITE_API_URL').describe('API base URL'),
    VITE_SITE_URL: requiredUrl('VITE_SITE_URL').describe('Public web app URL'),
    // Admin's own public URL. Used to build the absolute callbackUrl when the
    // _authed guard redirects unauthenticated users to the web signin (SPEC-182).
    VITE_ADMIN_URL: requiredUrl('VITE_ADMIN_URL').describe('Admin dashboard own public URL'),

    // Server-side API URL used by TanStack Start server functions (e.g. auth-session.ts).
    // Must be set as a plain process.env variable (no VITE_ prefix) since it is never
    // exposed to the browser bundle.
    HOSPEDA_API_URL: requiredUrl('HOSPEDA_API_URL').describe(
        'API base URL for server-side requests (server functions)'
    ),

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
    VITE_SENTRY_ENVIRONMENT: z
        .string()
        .optional()
        .describe(
            'Sentry environment tag (production | staging | development). Overrides import.meta.env.MODE so staging and prod (both MODE=production) end up in separate Sentry environments.'
        ),
    VITE_SENTRY_CSP_REPORT_URI: z
        .string()
        .url()
        .optional()
        .describe(
            'CSP violation report endpoint for a dedicated Sentry project (hospeda-csp), separate from VITE_SENTRY_DSN (admin app errors). Falls back to the VITE_SENTRY_DSN-derived report-uri when unset.'
        ),

    // Integrations — Cloudflare Turnstile (SPEC-301 T-010)
    // Public by design; ships in the admin browser bundle.
    // When unset, the invisible widget is not rendered and the server applies
    // its own fail-closed policy (admin feedback submissions would be rejected).
    VITE_TURNSTILE_SITE_KEY: z
        .string()
        .optional()
        .describe(
            'Cloudflare Turnstile site key for the admin feedback form. Passed as turnstileSiteKey prop; never read inside @repo/feedback.'
        ),

    // Analytics — PostHog Cloud (SPEC-140). Public by design; ship in bundle.
    // Leave unset to disable PostHog init in posthog-client.ts (T-140-17).
    // Per-env values come from Coolify; keys live in 1Password.
    VITE_POSTHOG_KEY: z
        .string()
        .optional()
        .describe('PostHog Cloud project API key (phc_...) for the admin app'),
    VITE_POSTHOG_HOST: z
        .string()
        .url()
        .optional()
        .describe('PostHog Cloud ingestion endpoint (defaults to https://us.i.posthog.com)'),

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
