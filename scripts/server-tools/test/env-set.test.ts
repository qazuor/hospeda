/**
 * Unit tests for the pure helpers backing `hops env-set --wizard`
 * (HOS-79 T-019). Covers AC-6 (default mode selects ONLY the gaps
 * `env-reconcile` would report, never the full registry), `--review-all`
 * selecting every applicable non-platform-injected entry, and secret
 * redaction in the "keep current value?" prompt label.
 *
 * Only the exported pure helpers are covered here (`selectWizardGaps`,
 * `selectWizardReviewAllEntries`, `formatCurrentValueLabel`,
 * `planWizardWriteAction`); the command wrapper does Coolify network I/O,
 * container lookup, and interactive prompting and is not exercised — no
 * test in this suite ever makes a network call or hits a real Coolify.
 */

import { describe, expect, it } from 'bun:test';
import {
    formatCurrentValueLabel,
    planWizardWriteAction,
    selectWizardGaps,
    selectWizardReviewAllEntries
} from '../src/commands/env-set.ts';
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

describe('selectWizardGaps (AC-6: default mode never walks the full registry)', () => {
    it('returns only entries missing on live Coolify that are required for a deployed target', () => {
        const registry = [
            makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api'], required: true }),
            makeEntry({ name: 'HOSPEDA_MISSING_SECRET', apps: ['api'], required: true }),
            makeEntry({ name: 'HOSPEDA_OPTIONAL', apps: ['api'], required: false })
        ];

        const result = selectWizardGaps({
            registry,
            app: 'api',
            coolifyKeys: ['HOSPEDA_API_URL']
        });

        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_MISSING_SECRET']);
    });

    it('returns an empty array when every required var is already present on Coolify', () => {
        const registry = [makeEntry({ name: 'HOSPEDA_API_URL', apps: ['api'], required: true })];

        const result = selectWizardGaps({
            registry,
            app: 'api',
            coolifyKeys: ['HOSPEDA_API_URL']
        });

        expect(result).toEqual([]);
    });

    it('scopes to the requested app only', () => {
        const registry = [makeEntry({ name: 'PUBLIC_SITE_URL', apps: ['web'], required: true })];

        const result = selectWizardGaps({ registry, app: 'api', coolifyKeys: [] });

        expect(result).toEqual([]);
    });

    it('never returns an optional or conditional entry, even when unset', () => {
        const registry = [
            makeEntry({ name: 'HOSPEDA_OPTIONAL', apps: ['api'], required: false }),
            makeEntry({
                name: 'HOSPEDA_CONDITIONAL',
                apps: ['api'],
                required: false,
                requiredScope: 'conditional'
            }),
            makeEntry({ name: 'HOSPEDA_REAL_GAP', apps: ['api'], required: true })
        ];

        const result = selectWizardGaps({ registry, app: 'api', coolifyKeys: [] });

        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_REAL_GAP']);
    });
});

describe('selectWizardReviewAllEntries', () => {
    it('returns every applicable entry, sorted by category then name', () => {
        const registry = [
            makeEntry({ name: 'HOSPEDA_Z', apps: ['api'], category: 'b' }),
            makeEntry({ name: 'HOSPEDA_A', apps: ['api'], category: 'a' }),
            makeEntry({ name: 'HOSPEDA_B', apps: ['api'], category: 'a' })
        ];

        const result = selectWizardReviewAllEntries({ registry, app: 'api' });

        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_A', 'HOSPEDA_B', 'HOSPEDA_Z']);
    });

    it('excludes platformInjected entries', () => {
        const registry = [
            makeEntry({ name: 'CI', apps: ['api'], platformInjected: true }),
            makeEntry({ name: 'HOSPEDA_REAL', apps: ['api'] })
        ];

        const result = selectWizardReviewAllEntries({ registry, app: 'api' });

        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_REAL']);
    });

    it('excludes entries not scoped to the requested app', () => {
        const registry = [makeEntry({ name: 'HOSPEDA_WEB_ONLY', apps: ['web'] })];

        const result = selectWizardReviewAllEntries({ registry, app: 'api' });

        expect(result).toEqual([]);
    });

    it('excludes framework-level keys the VPS wizard must not hand-set (M2)', () => {
        // NODE_ENV/API_PORT/API_HOST are NOT platformInjected in the registry
        // (they are dev-settable locally), but must never be written into
        // Coolify by hand — so the VPS wizard filters them out even in review.
        const registry = [
            makeEntry({ name: 'NODE_ENV', apps: ['api'] }),
            makeEntry({ name: 'API_PORT', apps: ['api'] }),
            makeEntry({ name: 'API_HOST', apps: ['api'] }),
            makeEntry({ name: 'HOSPEDA_REAL', apps: ['api'] })
        ];

        const result = selectWizardReviewAllEntries({ registry, app: 'api' });

        expect(result.map((e) => e.name)).toEqual(['HOSPEDA_REAL']);
    });
});

describe('formatCurrentValueLabel (secret redaction)', () => {
    it('redacts a set secret value', () => {
        const label = formatCurrentValueLabel({
            entry: { secret: true },
            currentValue: 'dummy-secret-value-123'
        });
        expect(label).toBe('***REDACTED***');
    });

    it('never leaks the real secret value in the label', () => {
        const label = formatCurrentValueLabel({
            entry: { secret: true },
            currentValue: 'super-secret-token'
        });
        expect(label).not.toContain('super-secret-token');
    });

    it('shows the real value for a non-secret entry', () => {
        const label = formatCurrentValueLabel({
            entry: { secret: false },
            currentValue: 'info'
        });
        expect(label).toBe('info');
    });

    it('shows <unset> when there is no current value, secret or not', () => {
        expect(formatCurrentValueLabel({ entry: { secret: true }, currentValue: undefined })).toBe(
            '<unset>'
        );
        expect(formatCurrentValueLabel({ entry: { secret: false }, currentValue: undefined })).toBe(
            '<unset>'
        );
    });

    it('treats an empty string current value the same as unset', () => {
        expect(formatCurrentValueLabel({ entry: { secret: false }, currentValue: '' })).toBe(
            '<unset>'
        );
    });
});

describe('planWizardWriteAction', () => {
    it('plans UPDATE when the key already exists on Coolify', () => {
        const action = planWizardWriteAction({
            key: 'HOSPEDA_FOO',
            existingKeys: ['HOSPEDA_FOO', 'OTHER_KEY']
        });
        expect(action).toBe('update');
    });

    it('plans CREATE when the key does not exist on Coolify', () => {
        const action = planWizardWriteAction({
            key: 'HOSPEDA_NEW',
            existingKeys: ['OTHER_KEY']
        });
        expect(action).toBe('create');
    });

    it('plans CREATE against an empty existing-keys list', () => {
        const action = planWizardWriteAction({ key: 'HOSPEDA_FOO', existingKeys: [] });
        expect(action).toBe('create');
    });
});
