/**
 * Unit tests for AI settings blob Zod schemas (SPEC-173).
 *
 * Coverage:
 *   - AiProviderConfigSchema: valid, missing enabled, unknown key rejected (.strict).
 *   - AiFeatureConfigSchema: valid, missing required fields, unknown key rejected.
 *   - AiCostCeilingsSchema: valid full/partial/empty; negative values rejected.
 *   - AiModelRateSchema: valid rate; negative rate rejected.
 *   - AiSettingsValueSchema (full blob): valid minimal; valid with ceilings;
 *     valid with modelRates; unknown top-level key rejected; bad provider config;
 *     bad feature config.
 *   - AiSettingsResponseSchema: valid envelope; bad updatedBy UUID.
 *
 * @module test/entities/ai/ai-settings.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AiCostCeilingsSchema,
    AiFeatureConfigSchema,
    AiModelRateSchema,
    AiProviderConfigSchema,
    AiSettingsResponseSchema,
    AiSettingsValueSchema
} from '../../../src/entities/ai/ai-settings.schema';

const VALID_ACTOR_UUID = '33333333-3333-4333-a333-333333333333';
const VALID_TIMESTAMP = '2026-06-04T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers: minimal valid sub-objects
// ---------------------------------------------------------------------------

const validProviderConfig = { enabled: true };

const validFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai' as const,
    fallbackChain: ['anthropic'] as const,
    model: 'gpt-4o-mini',
    params: { temperature: 0.5, maxTokens: 1024 }
};

const minimalSettingsValue = {
    providers: {
        openai: { enabled: true },
        anthropic: { enabled: false },
        stub: { enabled: false }
    },
    features: {
        text_improve: { ...validFeatureConfig },
        chat: { ...validFeatureConfig, model: 'gpt-4o', primaryProvider: 'openai' as const },
        search: {
            ...validFeatureConfig,
            model: 'gpt-4o-mini',
            primaryProvider: 'openai' as const,
            fallbackChain: []
        },
        support: {
            ...validFeatureConfig,
            model: 'claude-3-5-haiku-20241022',
            primaryProvider: 'anthropic' as const,
            fallbackChain: ['openai'] as const
        },
        translate: {
            ...validFeatureConfig,
            model: 'gemini-1.5-flash',
            primaryProvider: 'google' as const
        }
    }
};

// ---------------------------------------------------------------------------
// AiProviderConfigSchema
// ---------------------------------------------------------------------------

describe('AiProviderConfigSchema', () => {
    it('accepts { enabled: true }', () => {
        expect(AiProviderConfigSchema.safeParse(validProviderConfig).success).toBe(true);
    });

    it('accepts { enabled: false }', () => {
        expect(AiProviderConfigSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    it('rejects missing enabled field', () => {
        const result = AiProviderConfigSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('rejects unknown keys (.strict enforcement)', () => {
        const result = AiProviderConfigSchema.safeParse({ enabled: true, priority: 1 });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiFeatureConfigSchema
// ---------------------------------------------------------------------------

describe('AiFeatureConfigSchema', () => {
    it('accepts a fully valid feature config', () => {
        const result = AiFeatureConfigSchema.safeParse(validFeatureConfig);
        expect(result.success).toBe(true);
    });

    it('accepts an empty fallbackChain', () => {
        const result = AiFeatureConfigSchema.safeParse({
            ...validFeatureConfig,
            fallbackChain: []
        });
        expect(result.success).toBe(true);
    });

    it('accepts an empty params object', () => {
        const result = AiFeatureConfigSchema.safeParse({ ...validFeatureConfig, params: {} });
        expect(result.success).toBe(true);
    });

    it('rejects missing enabled', () => {
        const { enabled: _enabled, ...without } = validFeatureConfig;
        expect(AiFeatureConfigSchema.safeParse(without).success).toBe(false);
    });

    it('rejects missing primaryProvider', () => {
        const { primaryProvider: _p, ...without } = validFeatureConfig;
        expect(AiFeatureConfigSchema.safeParse(without).success).toBe(false);
    });

    it('rejects missing fallbackChain', () => {
        const { fallbackChain: _f, ...without } = validFeatureConfig;
        expect(AiFeatureConfigSchema.safeParse(without).success).toBe(false);
    });

    it('rejects missing model', () => {
        const { model: _m, ...without } = validFeatureConfig;
        expect(AiFeatureConfigSchema.safeParse(without).success).toBe(false);
    });

    it('rejects empty model string', () => {
        const result = AiFeatureConfigSchema.safeParse({ ...validFeatureConfig, model: '' });
        expect(result.success).toBe(false);
    });

    it('accepts any non-empty string as provider ID', () => {
        const result = AiFeatureConfigSchema.safeParse({
            ...validFeatureConfig,
            primaryProvider: 'gemini'
        });
        expect(result.success).toBe(true);
    });

    it('accepts custom providers in fallbackChain', () => {
        const result = AiFeatureConfigSchema.safeParse({
            ...validFeatureConfig,
            fallbackChain: ['openai', 'gemini']
        });
        expect(result.success).toBe(true);
    });

    it('rejects unknown keys (.strict enforcement)', () => {
        const result = AiFeatureConfigSchema.safeParse({
            ...validFeatureConfig,
            extraField: 'not-allowed'
        });
        expect(result.success).toBe(false);
    });

    it('rejects out-of-range temperature inside params', () => {
        const result = AiFeatureConfigSchema.safeParse({
            ...validFeatureConfig,
            params: { temperature: 3 }
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiCostCeilingsSchema
// ---------------------------------------------------------------------------

describe('AiCostCeilingsSchema', () => {
    it('accepts an empty object (all ceilings optional)', () => {
        expect(AiCostCeilingsSchema.safeParse({}).success).toBe(true);
    });

    it('accepts a global ceiling only', () => {
        const result = AiCostCeilingsSchema.safeParse({ globalMonthlyMicroUsd: 5_000_000_000 });
        expect(result.success).toBe(true);
    });

    it('accepts per-feature ceilings only', () => {
        const result = AiCostCeilingsSchema.safeParse({
            perFeatureMonthlyMicroUsd: { chat: 1_000_000_000, text_improve: 500_000_000 }
        });
        expect(result.success).toBe(true);
    });

    it('accepts a ceiling of 0 (intentional hard-stop)', () => {
        const result = AiCostCeilingsSchema.safeParse({ globalMonthlyMicroUsd: 0 });
        expect(result.success).toBe(true);
    });

    it('rejects negative globalMonthlyMicroUsd', () => {
        const result = AiCostCeilingsSchema.safeParse({ globalMonthlyMicroUsd: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer globalMonthlyMicroUsd', () => {
        const result = AiCostCeilingsSchema.safeParse({ globalMonthlyMicroUsd: 100.5 });
        expect(result.success).toBe(false);
    });

    it('rejects negative per-feature ceiling', () => {
        const result = AiCostCeilingsSchema.safeParse({
            perFeatureMonthlyMicroUsd: { chat: -500 }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown feature key in perFeatureMonthlyMicroUsd', () => {
        const result = AiCostCeilingsSchema.safeParse({
            perFeatureMonthlyMicroUsd: { unknown_feature: 1000 }
        });
        expect(result.success).toBe(false);
    });

    it('rejects unknown top-level keys (.strict enforcement)', () => {
        const result = AiCostCeilingsSchema.safeParse({
            globalMonthlyMicroUsd: 1000,
            perProviderMonthlyMicroUsd: {}
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiModelRateSchema
// ---------------------------------------------------------------------------

describe('AiModelRateSchema', () => {
    it('accepts a valid rate with both fields as non-negative integers', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 150_000,
            outputMicroUsdPerMillionTokens: 600_000
        });
        expect(result.success).toBe(true);
    });

    it('accepts zero rates (free model)', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 0,
            outputMicroUsdPerMillionTokens: 0
        });
        expect(result.success).toBe(true);
    });

    it('rejects a negative inputMicroUsdPerMillionTokens', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: -1,
            outputMicroUsdPerMillionTokens: 600_000
        });
        expect(result.success).toBe(false);
    });

    it('rejects a negative outputMicroUsdPerMillionTokens', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 150_000,
            outputMicroUsdPerMillionTokens: -1
        });
        expect(result.success).toBe(false);
    });

    it('rejects a float inputMicroUsdPerMillionTokens', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 150_000.5,
            outputMicroUsdPerMillionTokens: 600_000
        });
        expect(result.success).toBe(false);
    });

    it('rejects a float outputMicroUsdPerMillionTokens', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 150_000,
            outputMicroUsdPerMillionTokens: 600_000.9
        });
        expect(result.success).toBe(false);
    });

    it('rejects unknown extra keys (.strict enforcement)', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 150_000,
            outputMicroUsdPerMillionTokens: 600_000,
            cacheReadMicroUsdPerMillionTokens: 75_000
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing inputMicroUsdPerMillionTokens', () => {
        const result = AiModelRateSchema.safeParse({
            outputMicroUsdPerMillionTokens: 600_000
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing outputMicroUsdPerMillionTokens', () => {
        const result = AiModelRateSchema.safeParse({
            inputMicroUsdPerMillionTokens: 150_000
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiSettingsValueSchema (full blob)
// ---------------------------------------------------------------------------

describe('AiSettingsValueSchema', () => {
    it('accepts a minimal valid settings blob (no costCeilings)', () => {
        const result = AiSettingsValueSchema.safeParse(minimalSettingsValue);
        expect(result.success).toBe(true);
    });

    it('accepts a valid blob with cost ceilings', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            costCeilings: {
                globalMonthlyMicroUsd: 5_000_000_000,
                perFeatureMonthlyMicroUsd: { chat: 1_000_000_000 }
            }
        });
        expect(result.success).toBe(true);
    });

    it('accepts costCeilings as an empty object', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            costCeilings: {}
        });
        expect(result.success).toBe(true);
    });

    it('accepts a valid blob with modelRates override map', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            modelRates: {
                'gpt-4o-mini': {
                    inputMicroUsdPerMillionTokens: 150_000,
                    outputMicroUsdPerMillionTokens: 600_000
                }
            }
        });
        expect(result.success).toBe(true);
    });

    it('accepts blob without modelRates (optional field)', () => {
        const result = AiSettingsValueSchema.safeParse(minimalSettingsValue);
        expect(result.success).toBe(true);
    });

    it('rejects modelRates with an invalid rate (negative input rate)', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            modelRates: {
                'gpt-4o-mini': {
                    inputMicroUsdPerMillionTokens: -1,
                    outputMicroUsdPerMillionTokens: 600_000
                }
            }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown top-level key (.strict enforcement)', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            legacyConfig: { foo: 'bar' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing providers key', () => {
        const { providers: _providers, ...without } = minimalSettingsValue;
        expect(AiSettingsValueSchema.safeParse(without).success).toBe(false);
    });

    it('rejects missing features key', () => {
        const { features: _features, ...without } = minimalSettingsValue;
        expect(AiSettingsValueSchema.safeParse(without).success).toBe(false);
    });

    it('rejects an invalid provider in the providers map', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            providers: {
                ...minimalSettingsValue.providers,
                openai: { enabled: 'yes' } // not a boolean
            }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid feature config (empty model)', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            features: {
                ...minimalSettingsValue.features,
                chat: { ...minimalSettingsValue.features.chat, model: '' }
            }
        });
        expect(result.success).toBe(false);
    });

    it('accepts custom provider IDs in feature config', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            features: {
                ...minimalSettingsValue.features,
                search: {
                    ...minimalSettingsValue.features.search,
                    primaryProvider: 'gemini'
                }
            }
        });
        expect(result.success).toBe(true);
    });

    it('rejects negative cost ceiling inside the blob', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            costCeilings: { globalMonthlyMicroUsd: -100 }
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiSettingsResponseSchema
// ---------------------------------------------------------------------------

describe('AiSettingsResponseSchema', () => {
    const validResponse = {
        key: 'global' as const,
        value: minimalSettingsValue,
        updatedAt: VALID_TIMESTAMP,
        updatedBy: VALID_ACTOR_UUID
    };

    it('accepts a valid settings response envelope', () => {
        const result = AiSettingsResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.key).toBe('global');
        }
    });

    it('rejects a key other than "global"', () => {
        const result = AiSettingsResponseSchema.safeParse({ ...validResponse, key: 'regional' });
        expect(result.success).toBe(false);
    });

    it('rejects a non-ISO-8601 updatedAt', () => {
        const result = AiSettingsResponseSchema.safeParse({
            ...validResponse,
            updatedAt: '2026/06/04'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-UUID updatedBy', () => {
        const result = AiSettingsResponseSchema.safeParse({
            ...validResponse,
            updatedBy: 'admin-user'
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid value blob inside the response', () => {
        const result = AiSettingsResponseSchema.safeParse({
            ...validResponse,
            value: { providers: {}, features: {}, unknownKey: true }
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiSettingsValueSchema — opt-in moderation field
// ---------------------------------------------------------------------------

describe('AiSettingsValueSchema — moderation field (opt-in)', () => {
    it('accepts a blob without moderation (field absent = moderation disabled)', () => {
        // minimalSettingsValue has no moderation key — this is the normal case.
        const result = AiSettingsValueSchema.safeParse(minimalSettingsValue);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.moderation).toBeUndefined();
        }
    });

    it('accepts a blob with moderation.providerId set to a known provider', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            moderation: { providerId: 'openai' }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.moderation?.providerId).toBe('openai');
        }
    });

    it('accepts a blob with moderation.providerId set to a custom provider string', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            moderation: { providerId: 'my-custom-moderation-provider' }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.moderation?.providerId).toBe('my-custom-moderation-provider');
        }
    });

    it('rejects moderation object missing providerId', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            moderation: {}
        });
        expect(result.success).toBe(false);
    });

    it('rejects moderation object with empty string providerId', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            moderation: { providerId: '' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects moderation object with unknown extra keys (.strict enforcement)', () => {
        const result = AiSettingsValueSchema.safeParse({
            ...minimalSettingsValue,
            moderation: { providerId: 'openai', extraKey: true }
        });
        expect(result.success).toBe(false);
    });
});
