/**
 * Unit tests for the AI settings "Proveedor principal" helpers (BETA-130).
 *
 * Covers:
 * - `buildProviderOptions` includes the built-in `stub` provider and the
 *   feature's current value even when absent from `knownProviders`, deduped.
 * - Label markers for `stub` ("(prueba)") and disabled providers
 *   ("(deshabilitado)").
 * - `applyProviderToAllFeatures` calls `setFieldValue` for every feature id
 *   with the correct field path and provider id, and nothing else.
 */

import { describe, expect, it, vi } from 'vitest';
import type { AiFeatureId, AiProvidersMap } from '@/features/ai-settings';
import {
    applyProviderToAllFeatures,
    buildProviderOptions
} from '../-components/ai-settings-provider.utils';

describe('buildProviderOptions', () => {
    it('includes stub + current value + credentials, deduped', () => {
        const options = buildProviderOptions({
            knownProviders: ['openai', 'anthropic'],
            currentValue: 'stub',
            providers: { openai: { enabled: true }, anthropic: { enabled: true } }
        });

        expect(options.map((o) => o.value)).toEqual(['openai', 'anthropic', 'stub']);
    });

    it('never orphans a legacy/current provider absent from credentials', () => {
        const options = buildProviderOptions({
            knownProviders: ['openai'],
            currentValue: 'legacy-provider',
            providers: { openai: { enabled: true } }
        });

        expect(options.map((o) => o.value)).toEqual(['openai', 'stub', 'legacy-provider']);
    });

    it('does not duplicate stub when it is already the current value', () => {
        const options = buildProviderOptions({
            knownProviders: ['openai'],
            currentValue: 'stub',
            providers: { openai: { enabled: true } }
        });

        expect(options.filter((o) => o.value === 'stub')).toHaveLength(1);
    });

    it('does not duplicate a known provider when it is also the current value', () => {
        const options = buildProviderOptions({
            knownProviders: ['openai'],
            currentValue: 'openai',
            providers: { openai: { enabled: true } }
        });

        expect(options.filter((o) => o.value === 'openai')).toHaveLength(1);
    });

    it('marks stub with a "(prueba)" suffix', () => {
        const options = buildProviderOptions({
            knownProviders: [],
            currentValue: 'stub',
            providers: {}
        });

        const stubOption = options.find((o) => o.value === 'stub');
        expect(stubOption?.label).toContain('(prueba)');
    });

    it('marks a provider whose enabled flag is explicitly false as "(deshabilitado)"', () => {
        const providers: AiProvidersMap = { openai: { enabled: false } };
        const options = buildProviderOptions({
            knownProviders: ['openai'],
            currentValue: 'openai',
            providers
        });

        const openaiOption = options.find((o) => o.value === 'openai');
        expect(openaiOption?.label).toContain('(deshabilitado)');
    });

    it('does not mark a provider as disabled when it has no entry in providers', () => {
        const options = buildProviderOptions({
            knownProviders: ['openai'],
            currentValue: 'openai',
            providers: {}
        });

        const openaiOption = options.find((o) => o.value === 'openai');
        expect(openaiOption?.label).not.toContain('(deshabilitado)');
    });

    it('uses a real display label (not the raw id) for known providers', () => {
        const options = buildProviderOptions({
            knownProviders: ['openai'],
            currentValue: 'openai',
            providers: { openai: { enabled: true } }
        });

        const openaiOption = options.find((o) => o.value === 'openai');
        expect(openaiOption?.label).toContain('OpenAI');
    });
});

describe('applyProviderToAllFeatures', () => {
    const ALL_FEATURES: AiFeatureId[] = [
        'text_improve',
        'chat',
        'search',
        'support',
        'translate',
        'accommodation_import',
        'post_generate'
    ];

    it('sets primaryProvider on every feature via setFieldValue', () => {
        const setFieldValue = vi.fn();

        applyProviderToAllFeatures({
            form: { setFieldValue },
            providerId: 'anthropic',
            featureIds: ALL_FEATURES
        });

        expect(setFieldValue).toHaveBeenCalledTimes(ALL_FEATURES.length);
        for (const featureId of ALL_FEATURES) {
            expect(setFieldValue).toHaveBeenCalledWith(
                `features.${featureId}.primaryProvider`,
                'anthropic'
            );
        }
    });

    it('applies to a subset when given fewer feature ids', () => {
        const setFieldValue = vi.fn();

        applyProviderToAllFeatures({
            form: { setFieldValue },
            providerId: 'stub',
            featureIds: ['chat', 'search']
        });

        expect(setFieldValue).toHaveBeenCalledTimes(2);
        expect(setFieldValue).toHaveBeenCalledWith('features.chat.primaryProvider', 'stub');
        expect(setFieldValue).toHaveBeenCalledWith('features.search.primaryProvider', 'stub');
    });
});
