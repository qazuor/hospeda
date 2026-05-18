/**
 * @file env-registry-cross-validation.test.ts
 * @description Cross-validation between {@link AdminEnvSchema} and the
 * `ENV_REGISTRY` from `@repo/config`. Replaces the static-mirror approach in
 * `packages/config` with a direct read of the schema's `.shape` keys.
 *
 * Adopted by SPEC-090 (Option C). When this test fails, the failure message
 * names the specific var and where it should be added.
 */

import { ENV_REGISTRY } from '@repo/config';
import { describe, expect, it } from 'vitest';
import { AdminEnvSchema } from '../src/env';

const SCHEMA_KEYS = new Set<string>(Object.keys(AdminEnvSchema.shape));

const REGISTRY_KEYS_FOR_ADMIN = new Set<string>(
    ENV_REGISTRY.filter((entry) => entry.apps.includes('admin')).map((entry) => entry.name)
);

/**
 * Registry vars that are intentionally NOT validated by AdminEnvSchema.
 * Each entry must carry a documenting comment explaining why.
 *
 * The Vite build pipeline transforms `HOSPEDA_*` source vars into their
 * `VITE_*` counterparts at build time. The schema validates the `VITE_*`
 * names that ship to the bundle, so the `HOSPEDA_*` originals are listed
 * here as known gaps.
 */
const KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA = new Set<string>([
    // HOSPEDA_* vars renamed to VITE_* by the Vite build. The schema
    // validates the VITE_* form, not the HOSPEDA_* originals.
    'HOSPEDA_DEBUG_ACTOR_ID',
    'HOSPEDA_SUPPORTED_LOCALES',
    'HOSPEDA_DEFAULT_LOCALE',

    // VITE_LOG_* vars — consumed by the client-side logger via its own
    // section schema (sections/logger.schema.ts), not by AdminEnvSchema.
    'VITE_LOG_LEVEL',
    'VITE_LOG_INCLUDE_TIMESTAMPS',
    'VITE_LOG_INCLUDE_LEVEL',
    'VITE_LOG_USE_COLORS',

    // Build-time only — consumed by @sentry/vite-plugin during the admin
    // build to upload source maps. Not read by the runtime, so it is
    // deliberately absent from AdminEnvSchema.
    'SENTRY_AUTH_TOKEN'
]);

/**
 * Schema keys that are intentionally NOT in the registry.
 * The registry is documentation; some Vite-internal flags (`DEV`, `PROD`)
 * are set by the build runtime and are not user-configurable.
 */
const KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY = new Set<string>([
    // Vite internal flags — set by the build, not by the developer.
    'DEV',
    'PROD'
]);

describe('Admin env registry ↔ schema cross-validation (SPEC-090)', () => {
    it('every admin registry var should be present in AdminEnvSchema (excluding known gaps)', () => {
        const missing: string[] = [];

        for (const name of REGISTRY_KEYS_FOR_ADMIN) {
            if (KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA.has(name)) continue;
            if (!SCHEMA_KEYS.has(name)) missing.push(name);
        }

        expect(
            missing,
            `Registry vars for 'admin' missing from AdminEnvSchema:\n${missing.map((n) => `  - ${n}`).join('\n')}\n\nFix one of:\n  - Add the var to AdminEnvSchema in apps/admin/src/env.ts\n  - Add it to KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA in this file with a documenting comment`
        ).toHaveLength(0);
    });

    it('every AdminEnvSchema var should be present in the registry (excluding known gaps)', () => {
        const missing: string[] = [];

        for (const name of SCHEMA_KEYS) {
            if (KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY.has(name)) continue;
            if (!REGISTRY_KEYS_FOR_ADMIN.has(name)) missing.push(name);
        }

        expect(
            missing,
            `AdminEnvSchema vars missing from ENV_REGISTRY (apps: ['admin', ...]):\n${missing.map((n) => `  - ${n}`).join('\n')}\n\nAdd the var to packages/config/src/env-registry.*.ts with the appropriate metadata.`
        ).toHaveLength(0);
    });

    it('known schema gaps should still be absent from the schema', () => {
        const unexpectedlyPresent: string[] = [];

        for (const name of KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA) {
            if (SCHEMA_KEYS.has(name)) unexpectedlyPresent.push(name);
        }

        expect(
            unexpectedlyPresent,
            `These vars are in KNOWN_GAPS_REGISTRY_NOT_IN_SCHEMA but were added to AdminEnvSchema. Remove them from the gap set:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
        ).toHaveLength(0);
    });

    it('known registry gaps should still be absent from the registry', () => {
        const unexpectedlyPresent: string[] = [];

        for (const name of KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY) {
            if (REGISTRY_KEYS_FOR_ADMIN.has(name)) unexpectedlyPresent.push(name);
        }

        expect(
            unexpectedlyPresent,
            `These vars are in KNOWN_GAPS_SCHEMA_NOT_IN_REGISTRY but appear in the registry for 'admin'. Remove them from the gap set:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
        ).toHaveLength(0);
    });
});
