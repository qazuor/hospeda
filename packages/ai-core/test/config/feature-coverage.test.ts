/**
 * Tests for `findUnconfiguredFeatures` (HOS-1220).
 *
 * This helper is the detection half of the fail-open read: `readAiSettings` no
 * longer rejects a blob missing a feature key, so something has to say out loud
 * that the configuration is incomplete. The original outage produced ONE log
 * line in 24 hours, which is why the silence mattered as much as the throw.
 */

import type { AiFeatureConfig, AiSettingsValueResponse } from '@repo/schemas';
import { AiFeatureSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { findUnconfiguredFeatures } from '../../src/config/feature-coverage.js';

const FEATURE_CONFIG: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
};

/** A blob configuring every member of the enum. */
const buildCompleteSettings = (): AiSettingsValueResponse => ({
    providers: { openai: { enabled: true } },
    features: Object.fromEntries(
        AiFeatureSchema.options.map((feature) => [feature, { ...FEATURE_CONFIG }])
    ) as AiSettingsValueResponse['features']
});

describe('findUnconfiguredFeatures', () => {
    it('returns nothing when every feature is configured', () => {
        // Arrange
        const settings = buildCompleteSettings();

        // Act
        const result = findUnconfiguredFeatures({ settings });

        // Assert
        expect(result).toEqual([]);
    });

    it('names exactly the features the blob omits', () => {
        // Arrange — the shape every live environment held before HOS-1220.
        const settings = buildCompleteSettings();
        const features = { ...settings.features } as Record<string, unknown>;
        delete features.chat_gastronomy;
        delete features.chat_experience;

        // Act
        const result = findUnconfiguredFeatures({
            settings: { ...settings, features } as AiSettingsValueResponse
        });

        // Assert
        expect([...result].sort()).toEqual(['chat_experience', 'chat_gastronomy']);
    });

    it('reports every feature when there is no settings row at all', () => {
        // Arrange + Act — a platform nobody has configured yet.
        const result = findUnconfiguredFeatures({ settings: null });

        // Assert
        expect([...result].sort()).toEqual([...AiFeatureSchema.options].sort());
    });

    it('reports every feature for the empty blob the resolver falls back to', () => {
        // Arrange
        const settings: AiSettingsValueResponse = { providers: {}, features: {} };

        // Act
        const result = findUnconfiguredFeatures({ settings });

        // Assert
        expect(result).toHaveLength(AiFeatureSchema.options.length);
    });

    it('treats a DISABLED feature as configured — a kill-switch is a decision', () => {
        // Arrange — `enabled: false` is an operator turning something off on
        // purpose. Reporting it as unconfigured would alert on a working
        // platform every time somebody used the kill-switch.
        const settings = buildCompleteSettings();
        const features = {
            ...settings.features,
            chat: { ...FEATURE_CONFIG, enabled: false }
        };

        // Act
        const result = findUnconfiguredFeatures({
            settings: { ...settings, features } as AiSettingsValueResponse
        });

        // Assert
        expect(result).toEqual([]);
    });
});
