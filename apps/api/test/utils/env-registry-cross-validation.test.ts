/**
 * @file env-registry-cross-validation.test.ts
 * @description Cross-validation between {@link ApiEnvBaseSchema} and the
 * `ENV_REGISTRY` from `@repo/config`. Replaces the static-mirror approach in
 * `packages/config` with a direct read of the schema's `.shape` keys.
 *
 * Adopted by SPEC-090 (Option C). When this test fails, the failure message
 * names the specific var and where it should be added.
 */

import { ENV_REGISTRY } from '@repo/config';
import { describe, expect, it } from 'vitest';
import { ApiEnvBaseSchema } from '../../src/utils/env';

const SCHEMA_KEYS = new Set<string>(Object.keys(ApiEnvBaseSchema.shape));

const REGISTRY_KEYS_FOR_API = new Set<string>(
    ENV_REGISTRY.filter((entry) => entry.apps.includes('api')).map((entry) => entry.name)
);

/**
 * Registry vars that are intentionally NOT validated by ApiEnvSchema.
 * Each entry must carry a documenting comment explaining why.
 *
 * When a var here is added to ApiEnvSchema, the test below will fail with a
 * message instructing you to remove it from this set.
 */
const KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA = new Set<string>([
    // Billing — registered for tooling/docs but not yet validated as required.
    // Track as TODO: add to ApiEnvSchema once billing integration is stable.
    // Note: HOSPEDA_MERCADO_PAGO_SANDBOX is already validated by ApiEnvSchema
    // (added during the VPS migration sprint so Coolify env validation catches
    // a missing sandbox toggle); kept out of this gap set.
    'HOSPEDA_MERCADO_PAGO_TIMEOUT',
    'HOSPEDA_MERCADO_PAGO_PLATFORM_ID',
    'HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID',

    // Test infrastructure — only used by tests, not by the API runtime.
    'TEST_DB_URL',
    'TEST_DB_NAME',

    // Messaging moderation — registered for documentation; values are loaded
    // by the messaging service via its own section schema, not by ApiEnvSchema.
    'HOSPEDA_MESSAGING_BLOCKED_WORDS',
    'HOSPEDA_MESSAGING_BLOCKED_DOMAINS',

    // Build-time only — consumed by @sentry/esbuild-plugin during the API
    // build to upload source maps. Not read by the runtime, so it is
    // deliberately absent from ApiEnvBaseSchema. Registered with apps: ['api']
    // so it shows up in the API .env.example for build-environment setup.
    'SENTRY_AUTH_TOKEN'
]);

/**
 * Schema keys that are intentionally NOT in the registry.
 * The registry is documentation; some Zod-only keys (Vercel/CI platform-injected
 * variables, build metadata) are not user-configurable and are deliberately
 * excluded from `.env.example` and the public docs.
 */
const KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY = new Set<string>([
    // (none — all schema keys currently have a registry entry)
]);

describe('API env registry ↔ schema cross-validation (SPEC-090)', () => {
    it('every api registry var should be present in ApiEnvSchema (excluding known gaps)', () => {
        const missing: string[] = [];

        for (const name of REGISTRY_KEYS_FOR_API) {
            if (KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA.has(name)) continue;
            if (!SCHEMA_KEYS.has(name)) missing.push(name);
        }

        expect(
            missing,
            `Registry vars for 'api' missing from ApiEnvSchema:\n${missing.map((n) => `  - ${n}`).join('\n')}\n\nFix one of:\n  - Add the var to ApiEnvBaseSchema in apps/api/src/utils/env.ts\n  - Add it to KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA in this file with a documenting comment`
        ).toHaveLength(0);
    });

    it('every ApiEnvSchema var should be present in the registry (excluding known gaps)', () => {
        const missing: string[] = [];

        for (const name of SCHEMA_KEYS) {
            if (KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY.has(name)) continue;
            if (!REGISTRY_KEYS_FOR_API.has(name)) missing.push(name);
        }

        expect(
            missing,
            `ApiEnvSchema vars missing from ENV_REGISTRY (apps: ['api', ...]):\n${missing.map((n) => `  - ${n}`).join('\n')}\n\nAdd the var to packages/config/src/env-registry.*.ts with the appropriate metadata.`
        ).toHaveLength(0);
    });

    it('known schema gaps should still be absent from the schema', () => {
        const unexpectedlyPresent: string[] = [];

        for (const name of KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA) {
            if (SCHEMA_KEYS.has(name)) unexpectedlyPresent.push(name);
        }

        expect(
            unexpectedlyPresent,
            `These vars are in KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA but were added to ApiEnvSchema. Remove them from the gap set:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
        ).toHaveLength(0);
    });

    it('known registry gaps should still be absent from the registry', () => {
        const unexpectedlyPresent: string[] = [];

        for (const name of KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY) {
            if (REGISTRY_KEYS_FOR_API.has(name)) unexpectedlyPresent.push(name);
        }

        expect(
            unexpectedlyPresent,
            `These vars are in KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY but appear in the registry for 'api'. Remove them from the gap set:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
        ).toHaveLength(0);
    });
});
