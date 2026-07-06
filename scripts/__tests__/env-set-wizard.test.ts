/**
 * @file env-set-wizard.test.ts
 * @description Fixture-driven unit tests for the pure helpers backing
 * `pnpm env:set` (HOS-79 T-018). Covers AC-6 (default mode selects ONLY the
 * always-required gaps, never the full registry) and the dotenv upsert
 * (preserves existing lines/comments, updates in place, appends new keys
 * under a managed section). No interactive prompting or filesystem I/O is
 * exercised here — those live in `main()`, which is not imported by tests
 * (guarded by the `isMainModule` check).
 */

import { describe, expect, it } from 'vitest';
import type { EnvVarDefinition } from '../../packages/config/src/env-registry-types.js';
import { selectGapsToPrompt, selectReviewAllEntries, upsertDotenv } from '../env-set-wizard.js';

/** Minimal fixture builder for an EnvVarDefinition — mirrors check-env-local.test.ts's convention. */
function buildEntry(overrides: Partial<EnvVarDefinition> & { name: string }): EnvVarDefinition {
    return {
        description: `Fixture entry for ${overrides.name}`,
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'example',
        apps: ['api'],
        category: 'fixture',
        ...overrides
    };
}

describe('selectGapsToPrompt (AC-6: default mode never walks the full registry)', () => {
    it('returns only the always-required entries missing from localValues', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_ALWAYS_MISSING', requiredScope: 'always', apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_ALWAYS_PRESENT', requiredScope: 'always', apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_OPTIONAL', required: false, apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_PROD_ONLY', requiredScope: 'production', apps: ['api'] })
        ];
        const localValues = { HOSPEDA_ALWAYS_PRESENT: 'value' };

        // Act
        const result = selectGapsToPrompt({ registry, localValues, app: 'api' });

        // Assert: only the missing always-required entry — never the
        // optional or production-scoped ones, and never the whole registry.
        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_ALWAYS_MISSING']);
    });

    it('returns an empty array when every always-required var is already present', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_ALWAYS', requiredScope: 'always', apps: ['api'] })
        ];
        const localValues = { HOSPEDA_ALWAYS: 'value' };

        // Act
        const result = selectGapsToPrompt({ registry, localValues, app: 'api' });

        // Assert
        expect(result).toEqual([]);
    });

    it('scopes to the requested app only', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_WEB_ONLY', requiredScope: 'always', apps: ['web'] })
        ];

        // Act
        const result = selectGapsToPrompt({ registry, localValues: {}, app: 'api' });

        // Assert
        expect(result).toEqual([]);
    });

    it('never returns more entries than the registry has always-required gaps, even with a large registry', () => {
        // Arrange: 10 optional entries + 1 real gap — simulates "not the
        // whole ~224-entry registry".
        const registry = [
            ...Array.from({ length: 10 }, (_, i) =>
                buildEntry({ name: `HOSPEDA_OPTIONAL_${i}`, required: false, apps: ['api'] })
            ),
            buildEntry({ name: 'HOSPEDA_REAL_GAP', requiredScope: 'always', apps: ['api'] })
        ];

        // Act
        const result = selectGapsToPrompt({ registry, localValues: {}, app: 'api' });

        // Assert
        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_REAL_GAP']);
    });
});

describe('selectReviewAllEntries', () => {
    it('returns every entry applicable to the app, sorted by category then name', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_Z', category: 'b', apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_A', category: 'a', apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_B', category: 'a', apps: ['api'] })
        ];

        // Act
        const result = selectReviewAllEntries({ registry, app: 'api' });

        // Assert
        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_A', 'HOSPEDA_B', 'HOSPEDA_Z']);
    });

    it('excludes platformInjected entries', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'CI', platformInjected: true, apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_REAL', apps: ['api'] })
        ];

        // Act
        const result = selectReviewAllEntries({ registry, app: 'api' });

        // Assert
        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_REAL']);
    });

    it('excludes entries not scoped to the requested app', () => {
        // Arrange
        const registry = [buildEntry({ name: 'HOSPEDA_WEB_ONLY', apps: ['web'] })];

        // Act
        const result = selectReviewAllEntries({ registry, app: 'api' });

        // Assert
        expect(result).toEqual([]);
    });
});

describe('upsertDotenv', () => {
    it('appends a new key under the managed section when the file is empty', () => {
        // Act
        const result = upsertDotenv({ original: '', updates: { HOSPEDA_FOO: 'bar' } });

        // Assert
        expect(result).toBe('# --- Added by `pnpm env:set` (HOS-79 T-018) ---\nHOSPEDA_FOO=bar\n');
    });

    it('updates an existing key in place, preserving every other line untouched', () => {
        // Arrange
        const original = '# a comment\nHOSPEDA_FOO=old\n\nHOSPEDA_BAR=unchanged\n';

        // Act
        const result = upsertDotenv({ original, updates: { HOSPEDA_FOO: 'new' } });

        // Assert
        expect(result).toBe('# a comment\nHOSPEDA_FOO=new\n\nHOSPEDA_BAR=unchanged\n');
    });

    it('appends a genuinely new key after existing content, under a single managed-section header', () => {
        // Arrange
        const original = 'HOSPEDA_BAR=unchanged\n';

        // Act
        const result = upsertDotenv({ original, updates: { HOSPEDA_NEW: 'value' } });

        // Assert
        expect(result).toBe(
            'HOSPEDA_BAR=unchanged\n\n# --- Added by `pnpm env:set` (HOS-79 T-018) ---\nHOSPEDA_NEW=value\n'
        );
    });

    it('updates one key and appends another in the same call, adding the header only once', () => {
        // Arrange
        const original = 'HOSPEDA_FOO=old\n';

        // Act
        const result = upsertDotenv({
            original,
            updates: { HOSPEDA_FOO: 'new', HOSPEDA_NEW: 'value' }
        });

        // Assert
        expect(result).toBe(
            'HOSPEDA_FOO=new\n\n# --- Added by `pnpm env:set` (HOS-79 T-018) ---\nHOSPEDA_NEW=value\n'
        );
    });

    it('handles a file with no trailing newline the same as one with one', () => {
        // Arrange
        const original = 'HOSPEDA_FOO=old';

        // Act
        const result = upsertDotenv({ original, updates: { HOSPEDA_FOO: 'new' } });

        // Assert
        expect(result).toBe('HOSPEDA_FOO=new\n');
    });

    it('is a no-op content-wise (only re-normalizes trailing newline) when updates is empty', () => {
        // Arrange
        const original = '# comment\nHOSPEDA_FOO=bar\n';

        // Act
        const result = upsertDotenv({ original, updates: {} });

        // Assert
        expect(result).toBe('# comment\nHOSPEDA_FOO=bar\n');
    });

    it('never touches a comment line even if it looks like it mentions a key being updated', () => {
        // Arrange
        const original = '# HOSPEDA_FOO is important\nHOSPEDA_FOO=old\n';

        // Act
        const result = upsertDotenv({ original, updates: { HOSPEDA_FOO: 'new' } });

        // Assert
        expect(result).toBe('# HOSPEDA_FOO is important\nHOSPEDA_FOO=new\n');
    });
});
