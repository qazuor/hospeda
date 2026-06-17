/**
 * @file env-registry-cross-validation.test.ts
 * @description Cross-validation between {@link serverEnvBaseSchema} and the
 * `ENV_REGISTRY` from `@repo/config`. Replaces the static-mirror approach in
 * `packages/config` with a direct read of the schema's `.shape` keys.
 *
 * Adopted by SPEC-090 (Option C). When this test fails, the failure message
 * names the specific var and where it should be added.
 */

import { ENV_REGISTRY } from '@repo/config';
import { describe, expect, it } from 'vitest';
import { serverEnvBaseSchema } from '../../src/env';

const SCHEMA_KEYS = new Set<string>(Object.keys(serverEnvBaseSchema.shape));

const REGISTRY_KEYS_FOR_WEB = new Set<string>(
    ENV_REGISTRY.filter((entry) => entry.apps.includes('web')).map((entry) => entry.name)
);

/**
 * Registry vars that are intentionally NOT validated by serverEnvSchema.
 */
const KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA = new Set<string>([
    // (PUBLIC_ENABLE_LOGGING was previously here as an exception — registered
    // post-Astro 6 audit: now validated by serverEnvSchema and read through
    // getEnv() in lib/env.ts instead of raw import.meta.env.)

    // Build-time only — consumed by @sentry/astro during the web build to
    // upload source maps. Not read by the runtime, so it is deliberately
    // absent from serverEnvSchema.
    'SENTRY_AUTH_TOKEN',

    // Platform-injected by Vercel — sentry.server.config.ts reads
    // VERCEL_GIT_COMMIT_SHA to stamp the release identifier, but
    // serverEnvBaseSchema validates only the server runtime vars. Registered
    // in SYSTEM_ENV_VARS with apps: ['api', 'web', 'admin'] so they appear
    // in the web .env.example for reference.
    'VERCEL',
    'VERCEL_GIT_COMMIT_SHA'
]);

/**
 * Schema keys that are intentionally NOT in the registry.
 */
const KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY = new Set<string>([
    // (none — all schema keys currently have a registry entry)
]);

describe('Web env registry ↔ schema cross-validation (SPEC-090)', () => {
    it('every web registry var should be present in serverEnvSchema (excluding known gaps)', () => {
        const missing: string[] = [];

        for (const name of REGISTRY_KEYS_FOR_WEB) {
            if (KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA.has(name)) continue;
            if (!SCHEMA_KEYS.has(name)) missing.push(name);
        }

        expect(
            missing,
            `Registry vars for 'web' missing from serverEnvSchema:\n${missing.map((n) => `  - ${n}`).join('\n')}\n\nFix one of:\n  - Add the var to serverEnvBaseSchema in apps/web/src/env.ts\n  - Add it to KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA in this file with a documenting comment`
        ).toHaveLength(0);
    });

    it('every serverEnvSchema var should be present in the registry (excluding known gaps)', () => {
        const missing: string[] = [];

        for (const name of SCHEMA_KEYS) {
            if (KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY.has(name)) continue;
            if (!REGISTRY_KEYS_FOR_WEB.has(name)) missing.push(name);
        }

        expect(
            missing,
            `serverEnvSchema vars missing from ENV_REGISTRY (apps: ['web', ...]):\n${missing.map((n) => `  - ${n}`).join('\n')}\n\nAdd the var to packages/config/src/env-registry.*.ts with the appropriate metadata.`
        ).toHaveLength(0);
    });

    it('known schema gaps should still be absent from the schema', () => {
        const unexpectedlyPresent: string[] = [];

        for (const name of KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA) {
            if (SCHEMA_KEYS.has(name)) unexpectedlyPresent.push(name);
        }

        expect(
            unexpectedlyPresent,
            `These vars are in KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA but were added to serverEnvSchema. Remove them from the gap set:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
        ).toHaveLength(0);
    });

    it('known registry gaps should still be absent from the registry', () => {
        const unexpectedlyPresent: string[] = [];

        for (const name of KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY) {
            if (REGISTRY_KEYS_FOR_WEB.has(name)) unexpectedlyPresent.push(name);
        }

        expect(
            unexpectedlyPresent,
            `These vars are in KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY but appear in the registry for 'web'. Remove them from the gap set:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
        ).toHaveLength(0);
    });
});
