import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStartupValidator } from '@repo/config';
import { createLogger } from '@repo/logger';
/**
 * Environment configuration with validation.
 * Uses @repo/config for centralized environment variable management.
 *
 * Config helpers (getCacheConfig, getCorsConfig, etc.) live in
 * `env-config-helpers.ts` and are re-exported from here for backward
 * compatibility.
 */
import { config } from 'dotenv';
import { z } from 'zod';
import { ApiEnvBaseSchema } from './env-schema.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLogger = createLogger('env');

// Locate the app root reliably in both source (src/utils/env.ts) and bundled
// (dist/index.js) modes. Walking up via __dirname fails in the bundled case
// because tsup collapses the directory depth from two levels (src/utils → app)
// to one (dist → app).  process.cwd() is the canonical app root when executed
// via `pnpm <script>` because pnpm always cd-s into the package directory.
const appDir = (() => {
    const cwd = process.cwd();
    // Verify cwd looks like our app root (has package.json). If not — e.g. when
    // running tests that do not cd — fall back to the old dirname-based path so
    // existing test setups keep working without change.
    if (existsSync(resolve(cwd, 'package.json'))) {
        return cwd;
    }
    // Fallback: works for source layout (src/utils/env.ts → two levels up)
    return resolve(__dirname, '../..');
})();
const envFiles = [resolve(appDir, '.env.local')];

if (process.env.NODE_ENV === 'test') {
    envFiles.unshift(resolve(appDir, '.env.test'));
}

for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    try {
        const result = config({ path: envFile });
        if (result?.error) {
            envLogger.warn({
                message: 'Could not load env file',
                file: envFile,
                error: result.error.message
            });
        }
    } catch (error) {
        envLogger.warn({
            message: 'Error loading env file',
            file: envFile,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

// `ApiEnvBaseSchema` (the plain key set, no cross-field validation) now lives
// in the pure `env-schema.ts` sibling file — see its module docblock for why.
// Re-exported here so every existing importer (notably the env-registry
// cross-validation test) keeps working unchanged.
export { ApiEnvBaseSchema };

/**
 * API-specific environment schema with cross-field validation.
 * All variables use the HOSPEDA_* prefix for consistency.
 *
 * The `.superRefine` block enforces production constraints (CRON_SECRET,
 * REDIS_URL), OAuth secret/ID pairing, and localhost rejection in CORS/CSRF
 * origins. The plain key set lives in {@link ApiEnvBaseSchema}.
 */
const ApiEnvSchema = ApiEnvBaseSchema.superRefine((data, ctx) => {
    if (
        data.NODE_ENV === 'production' &&
        (!data.HOSPEDA_REDIS_URL || data.HOSPEDA_REDIS_URL.trim() === '')
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_REDIS_URL'],
            message:
                'HOSPEDA_REDIS_URL is required in production for rate limiting to work across instances'
        });
    }
    // AI credential vault master key is REQUIRED in production: the vault crypto
    // cannot decrypt provider credentials without it, so a missing key would let
    // the API boot but fail every AI call at runtime. Fail fast at startup instead.
    if (
        data.NODE_ENV === 'production' &&
        (!data.HOSPEDA_AI_VAULT_MASTER_KEY || data.HOSPEDA_AI_VAULT_MASTER_KEY.trim() === '')
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_AI_VAULT_MASTER_KEY'],
            message:
                'HOSPEDA_AI_VAULT_MASTER_KEY is required in production (vault crypto cannot decrypt AI provider credentials without it)'
        });
    }
    // OAuth cross-validation: require secret when client ID is set
    if (data.HOSPEDA_GOOGLE_CLIENT_ID && !data.HOSPEDA_GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_GOOGLE_CLIENT_SECRET'],
            message: 'HOSPEDA_GOOGLE_CLIENT_SECRET is required when HOSPEDA_GOOGLE_CLIENT_ID is set'
        });
    }
    if (data.HOSPEDA_FACEBOOK_CLIENT_ID && !data.HOSPEDA_FACEBOOK_CLIENT_SECRET) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_FACEBOOK_CLIENT_SECRET'],
            message:
                'HOSPEDA_FACEBOOK_CLIENT_SECRET is required when HOSPEDA_FACEBOOK_CLIENT_ID is set'
        });
    }
    // Production safety: reject test/debug flags that would weaken security if accidentally set.
    // These have use-site gates today, but a future refactor could drop them silently. The
    // schema-level guard ensures the deploy fails fast at startup.
    if (data.NODE_ENV === 'production') {
        if (data.HOSPEDA_API_DEBUG_ERRORS === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_API_DEBUG_ERRORS'],
                message:
                    'HOSPEDA_API_DEBUG_ERRORS must not be true in production (would leak stack traces)'
            });
        }
        if (data.HOSPEDA_DISABLE_AUTH === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_DISABLE_AUTH'],
                message: 'HOSPEDA_DISABLE_AUTH must not be true in production (auth bypass)'
            });
        }
        if (data.HOSPEDA_ALLOW_MOCK_ACTOR === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_ALLOW_MOCK_ACTOR'],
                message:
                    'HOSPEDA_ALLOW_MOCK_ACTOR must not be true in production (impersonation vector)'
            });
        }
        if (data.HOSPEDA_DEBUG_TESTS === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_DEBUG_TESTS'],
                message: 'HOSPEDA_DEBUG_TESTS must not be true in production (log spam)'
            });
        }
    }
    // Reject localhost/127.0.0.1 in CORS and CSRF origins in production
    if (data.NODE_ENV === 'production') {
        const localhostPattern = /localhost|127\.0\.0\.1/i;
        const corsOrigins = data.API_CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
        for (const origin of corsOrigins) {
            if (localhostPattern.test(origin)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['API_CORS_ORIGINS'],
                    message: `CORS origin '${origin}' contains localhost, which is not allowed in production`
                });
            }
        }
    }
    // Conditional: the OpenAI moderation key is required when the OpenAI provider
    // is selected (all environments). With the 'stub'/'local' providers it is not
    // needed, so it stays unset without aborting startup.
    if (
        data.HOSPEDA_MODERATION_PROVIDER === 'openai' &&
        (!data.HOSPEDA_MODERATION_OPENAI_API_KEY ||
            data.HOSPEDA_MODERATION_OPENAI_API_KEY.trim() === '')
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_MODERATION_OPENAI_API_KEY'],
            message:
                'HOSPEDA_MODERATION_OPENAI_API_KEY is required when HOSPEDA_MODERATION_PROVIDER=openai'
        });
    }
    // Required only in production: external-service credentials whose absence would
    // let the API boot but silently break the feature in prod. Fail loud at startup
    // instead of degrading silently. Mirrors the REDIS_URL / AI_VAULT guards above.
    if (data.NODE_ENV === 'production') {
        const requiredInProd: ReadonlyArray<readonly [string, string | undefined]> = [
            ['HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', data.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN],
            ['HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', data.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET],
            ['HOSPEDA_EMAIL_API_KEY', data.HOSPEDA_EMAIL_API_KEY],
            ['HOSPEDA_EMAIL_FROM_EMAIL', data.HOSPEDA_EMAIL_FROM_EMAIL],
            ['HOSPEDA_SENTRY_DSN', data.HOSPEDA_SENTRY_DSN],
            ['HOSPEDA_LINEAR_API_KEY', data.HOSPEDA_LINEAR_API_KEY],
            ['HOSPEDA_POSTHOG_KEY', data.HOSPEDA_POSTHOG_KEY],
            ['HOSPEDA_APIFY_TOKEN', data.HOSPEDA_APIFY_TOKEN],
            ['HOSPEDA_GOOGLE_PLACES_API_KEY', data.HOSPEDA_GOOGLE_PLACES_API_KEY]
        ];
        for (const [name, value] of requiredInProd) {
            if (!value || value.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [name],
                    message: `${name} is required in production`
                });
            }
        }
    }
});

/**
 * Creates the API environment validation function.
 * @remarks
 * `ApiEnvSchema` uses `.superRefine()` which produces a `ZodEffects` type.
 * `ZodEffects` extends `ZodType` but TypeScript does not infer the constraint
 * automatically across Zod v4 type boundaries.
 * @see createStartupValidator
 */
const _validateApiEnv = createStartupValidator(
    // biome-ignore lint/suspicious/noExplicitAny: ZodEffects from .superRefine() is not assignable to ZodSchema<T> in Zod v4
    ApiEnvSchema as any,
    'API'
);

/**
 * The validated API environment object.
 * Populated after calling {@link validateApiEnv}.
 */
export let env: z.infer<typeof ApiEnvSchema>;

/**
 * Validate and populate the environment object.
 * Must be called before accessing {@link env}.
 */
export const validateApiEnv = (): void => {
    env = _validateApiEnv() as z.infer<typeof ApiEnvSchema>;
    // NOTE: intentionally does NOT log here. validateApiEnv() is called from
    // more than one module (server bootstrap + response-validator), so logging
    // inside it duplicated the line, and it ran before configureLogger() applied
    // the prod JSON format — emitting the boot summary in ANSI. The server logs
    // a single safe summary from index.ts AFTER configureLogger() instead (I3).
};

// Export the schema for testing
export { ApiEnvSchema };

// Re-export config helpers for backward compatibility
export {
    parseCommaSeparated,
    parseCorsOrigins,
    getCacheConfig,
    getCorsConfig,
    getCompressionConfig,
    getRateLimitConfig,
    getSecurityConfig,
    getValidationConfig,
    getResponseConfig,
    getDatabasePoolConfig
} from './env-config-helpers.js';
