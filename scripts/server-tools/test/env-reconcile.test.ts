/**
 * Unit tests for `src/commands/env-reconcile.ts` — the pure registry-vs-
 * Coolify diff (HOS-79 T-015, AC-4). Only the exported pure helpers are
 * covered here (`diffRegistryVsCoolify`, `isRequiredForDeployedTarget`);
 * the command wrapper does Coolify network I/O and container lookup and is
 * not exercised — no test in this suite ever makes a network call.
 */

import { describe, expect, it } from 'bun:test';
import {
    diffRegistryVsCoolify,
    isRequiredForDeployedTarget
} from '../src/commands/env-reconcile.ts';
import type { RegistryEnvVarDefinition } from '../src/lib/repo-root.ts';

function makeEntry(
    overrides: Partial<RegistryEnvVarDefinition> & Pick<RegistryEnvVarDefinition, 'name' | 'apps'>
): RegistryEnvVarDefinition {
    return {
        description: 'test var',
        type: 'string',
        required: false,
        secret: false,
        category: 'test',
        ...overrides
    };
}

describe('isRequiredForDeployedTarget()', () => {
    it('is required when required: true', () => {
        expect(isRequiredForDeployedTarget({ required: true })).toBe(true);
    });

    it('is required when requiredScope is production', () => {
        expect(isRequiredForDeployedTarget({ required: false, requiredScope: 'production' })).toBe(
            true
        );
    });

    it('is NOT required when requiredScope is conditional', () => {
        expect(isRequiredForDeployedTarget({ required: false, requiredScope: 'conditional' })).toBe(
            false
        );
    });

    it('is NOT required when required is false and requiredScope is absent', () => {
        expect(isRequiredForDeployedTarget({ required: false })).toBe(false);
    });

    it('is required when requiredScope is "always" alongside required: true', () => {
        expect(isRequiredForDeployedTarget({ required: true, requiredScope: 'always' })).toBe(true);
    });

    it('is required when requiredScope is "always" even if required is false (L2 guard)', () => {
        // The latent case check-env-local's isAlwaysRequired already guards:
        // an "always" scope must win regardless of the plain required flag, so
        // a genuinely-required var is never under-reported as missing on prod.
        expect(isRequiredForDeployedTarget({ required: false, requiredScope: 'always' })).toBe(
            true
        );
    });
});

describe('diffRegistryVsCoolify()', () => {
    it('reports nothing missing when every required var for the app is present', () => {
        const registry = [
            makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api', 'web'], required: true }),
            makeEntry({ name: 'HOSPEDA_DATABASE_URL', apps: ['api'], required: true })
        ];
        const result = diffRegistryVsCoolify({
            registry,
            app: 'api',
            coolifyKeys: ['HOSPEDA_API_URL', 'HOSPEDA_DATABASE_URL', 'UNRELATED_KEY_NOT_OURS']
        });
        expect(result.missing).toEqual([]);
    });

    it('reports a required var missing from Coolify (AC-4)', () => {
        const registry = [
            makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api'], required: true }),
            makeEntry({ name: 'HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', apps: ['api'], required: true })
        ];
        const result = diffRegistryVsCoolify({
            registry,
            app: 'api',
            coolifyKeys: ['HOSPEDA_API_URL']
        });
        expect(result.missing).toEqual(['HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN']);
    });

    it('gates requiredScope: production the same as required: true', () => {
        const registry = [
            makeEntry({
                name: 'HOSPEDA_SENTRY_DSN',
                apps: ['api'],
                required: false,
                requiredScope: 'production'
            })
        ];
        const result = diffRegistryVsCoolify({ registry, app: 'api', coolifyKeys: [] });
        expect(result.missing).toEqual(['HOSPEDA_SENTRY_DSN']);
    });

    it('never reports a requiredScope: conditional var as missing, even when unset', () => {
        const registry = [
            makeEntry({
                name: 'HOSPEDA_MODERATION_OPENAI_API_KEY',
                apps: ['api'],
                required: false,
                requiredScope: 'conditional',
                requiredWhen: 'HOSPEDA_MODERATION_PROVIDER=openai'
            })
        ];
        const result = diffRegistryVsCoolify({ registry, app: 'api', coolifyKeys: [] });
        expect(result.missing).toEqual([]);
        expect(result.conditionalUnset).toEqual(['HOSPEDA_MODERATION_OPENAI_API_KEY']);
    });

    it('ignores registry entries that do not apply to the requested app', () => {
        const registry = [
            makeEntry({ name: 'PUBLIC_SITE_URL', apps: ['web'], required: true }),
            makeEntry({ name: 'HOSPEDA_DATABASE_URL', apps: ['api'], required: true })
        ];
        const result = diffRegistryVsCoolify({
            registry,
            app: 'api',
            coolifyKeys: []
        });
        // Only the api-scoped var should be reported; the web-only var is
        // not this app's concern at all.
        expect(result.missing).toEqual(['HOSPEDA_DATABASE_URL']);
    });

    it('reports Coolify keys with no registry entry for the app as "unexpected", not a failure', () => {
        const registry = [makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api'], required: true })];
        const result = diffRegistryVsCoolify({
            registry,
            app: 'api',
            coolifyKeys: ['HOSPEDA_API_URL', 'SOME_LEGACY_VAR_NOBODY_REMOVED']
        });
        expect(result.missing).toEqual([]);
        expect(result.unexpected).toEqual(['SOME_LEGACY_VAR_NOBODY_REMOVED']);
    });

    it('sorts missing/unexpected/conditionalUnset alphabetically for stable output', () => {
        const registry = [
            makeEntry({ name: 'ZEBRA_VAR', apps: ['api'], required: true }),
            makeEntry({ name: 'ALPHA_VAR', apps: ['api'], required: true })
        ];
        const result = diffRegistryVsCoolify({ registry, app: 'api', coolifyKeys: [] });
        expect(result.missing).toEqual(['ALPHA_VAR', 'ZEBRA_VAR']);
    });

    it('returns empty arrays for an app with no registry entries and no Coolify keys', () => {
        const result = diffRegistryVsCoolify({ registry: [], app: 'admin', coolifyKeys: [] });
        expect(result).toEqual({ missing: [], unexpected: [], conditionalUnset: [] });
    });

    describe('platform-injected keys (env-registry-hygiene, follow-up to HOS-79)', () => {
        it('excludes HOST/PORT/HUSKY/NITRO_PRESET/HOSPEDA_GIT_SHA from "unexpected", never registered', () => {
            const registry = [makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api'], required: true })];
            const result = diffRegistryVsCoolify({
                registry,
                app: 'api',
                coolifyKeys: [
                    'HOSPEDA_API_URL',
                    'HOST',
                    'PORT',
                    'HUSKY',
                    'NITRO_PRESET',
                    'HOSPEDA_GIT_SHA'
                ]
            });
            expect(result.missing).toEqual([]);
            expect(result.unexpected).toEqual([]);
        });

        it('still reports a genuine registry gap alongside platform-injected keys', () => {
            const registry = [makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api'], required: true })];
            const result = diffRegistryVsCoolify({
                registry,
                app: 'api',
                coolifyKeys: ['HOSPEDA_API_URL', 'HOST', 'SOME_LEGACY_VAR_NOBODY_REMOVED']
            });
            expect(result.unexpected).toEqual(['SOME_LEGACY_VAR_NOBODY_REMOVED']);
        });
    });
});
