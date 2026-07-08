/**
 * Unit tests for `resolveCredentialModelsToPersist` (BETA credential-models
 * persist follow-up).
 *
 * Regression coverage for the bug where `CreateCredentialDialog.handleSubmit`
 * persisted ONLY `selectedModels` into `metadata.models`, completely ignoring
 * `disabledModels` — the pre-sync curated/custom model toggles had zero
 * effect on what actually got saved.
 *
 * Covers:
 * - Pre-sync with some curated models disabled: they are dropped from the
 *   persisted list.
 * - Pre-sync with a custom model added (and not disabled): it is kept.
 * - Pre-sync with a custom model added and then disabled: it is dropped too.
 * - Post-sync (`hasSyncedPreview: true`): returns `selectedModels` as-is,
 *   ignoring `disabledModels` entirely.
 * - Dedup and empty-result cases.
 */

import { describe, expect, it } from 'vitest';
import { resolveCredentialModelsToPersist } from '../-components/credential-models.utils';

describe('resolveCredentialModelsToPersist', () => {
    describe('pre-sync (hasSyncedPreview: false)', () => {
        it('drops curated models the user disabled', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
                selectedModels: [],
                disabledModels: ['gpt-4o-mini'],
                hasSyncedPreview: false
            });

            expect(result).toEqual(['gpt-4o', 'gpt-3.5-turbo']);
        });

        it('keeps all curated models when none are disabled', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o', 'gpt-4o-mini'],
                selectedModels: [],
                disabledModels: [],
                hasSyncedPreview: false
            });

            expect(result).toEqual(['gpt-4o', 'gpt-4o-mini']);
        });

        it('keeps a custom-added model that was not disabled', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o'],
                selectedModels: ['my-custom-model'],
                disabledModels: [],
                hasSyncedPreview: false
            });

            expect(result).toEqual(['gpt-4o', 'my-custom-model']);
        });

        it('drops a custom-added model that was toggled off', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o'],
                selectedModels: ['my-custom-model'],
                disabledModels: ['my-custom-model'],
                hasSyncedPreview: false
            });

            expect(result).toEqual(['gpt-4o']);
        });

        it('combines curated disables and custom adds correctly', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o', 'gpt-4o-mini'],
                selectedModels: ['custom-a', 'custom-b'],
                disabledModels: ['gpt-4o-mini', 'custom-a'],
                hasSyncedPreview: false
            });

            expect(result).toEqual(['gpt-4o', 'custom-b']);
        });

        it('returns an empty array when every model is disabled', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o'],
                selectedModels: ['custom-a'],
                disabledModels: ['gpt-4o', 'custom-a'],
                hasSyncedPreview: false
            });

            expect(result).toEqual([]);
        });

        it('dedupes when a curated model also appears in selectedModels', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o'],
                selectedModels: ['gpt-4o'],
                disabledModels: [],
                hasSyncedPreview: false
            });

            expect(result).toEqual(['gpt-4o']);
        });
    });

    describe('post-sync (hasSyncedPreview: true)', () => {
        it('returns selectedModels as-is, ignoring disabledModels entirely', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o', 'gpt-4o-mini'],
                selectedModels: ['gpt-4o', 'new-detected-model'],
                disabledModels: ['gpt-4o-mini'],
                hasSyncedPreview: true
            });

            expect(result).toEqual(['gpt-4o', 'new-detected-model']);
        });

        it('returns an empty array when nothing is selected', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: ['gpt-4o'],
                selectedModels: [],
                disabledModels: [],
                hasSyncedPreview: true
            });

            expect(result).toEqual([]);
        });

        it('dedupes selectedModels', () => {
            const result = resolveCredentialModelsToPersist({
                curatedModels: [],
                selectedModels: ['gpt-4o', 'gpt-4o'],
                disabledModels: [],
                hasSyncedPreview: true
            });

            expect(result).toEqual(['gpt-4o']);
        });
    });
});
