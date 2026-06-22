/**
 * Tests for ai-settings.schema.ts (SPEC-173 / empty-DB bug regression).
 *
 * Key invariants verified:
 * 1. AiSettingsResponseSchema ACCEPTS a payload with value.features = {} (empty)
 *    — the initial/no-row state must not 500.
 * 2. AiSettingsResponseSchema still REJECTS an invalid feature config shape.
 * 3. AiSettingsValueSchema (PUT body) REJECTS an empty/partial feature map —
 *    the write contract is NOT relaxed.
 * 4. AiSettingsValueSchema ACCEPTS a full valid feature map.
 */

import { describe, expect, it } from 'vitest';
import { AiSettingsResponseSchema, AiSettingsValueSchema } from '../ai-settings.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_UUID = '00000000-0000-4000-8000-000000000000';
const VALID_DATETIME = '2026-01-01T00:00:00.000Z';

/** A full, valid feature config entry. */
const VALID_FEATURE_CONFIG = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
} as const;

/** A complete, valid feature map with all required keys. */
const FULL_FEATURES_MAP = {
    text_improve: VALID_FEATURE_CONFIG,
    chat: { ...VALID_FEATURE_CONFIG, enabled: false },
    search: { ...VALID_FEATURE_CONFIG, enabled: false },
    support: { ...VALID_FEATURE_CONFIG, enabled: false },
    translate: { ...VALID_FEATURE_CONFIG, enabled: false },
    accommodation_import: { ...VALID_FEATURE_CONFIG, enabled: false },
    post_generate: { ...VALID_FEATURE_CONFIG, enabled: false }
} as const;

/** A valid full settings value blob. */
const VALID_SETTINGS_BLOB = {
    providers: { openai: { enabled: true } },
    features: FULL_FEATURES_MAP
} as const;

/** A minimal valid response envelope wrapping the full blob. */
const VALID_RESPONSE = {
    key: 'global' as const,
    value: VALID_SETTINGS_BLOB,
    updatedAt: VALID_DATETIME,
    updatedBy: VALID_UUID
};

// ============================================================================
// AiSettingsResponseSchema — empty-DB regression (the bug this test guards)
// ============================================================================

describe('AiSettingsResponseSchema', () => {
    describe('empty initial-DB state (regression: was HTTP 500)', () => {
        it('should ACCEPT value.features = {} (empty map — no config saved yet)', () => {
            // Arrange: the state resolveConfig() returns on a fresh DB.
            const emptyStateResponse = {
                key: 'global' as const,
                value: {
                    providers: {},
                    features: {}
                },
                updatedAt: VALID_DATETIME,
                updatedBy: VALID_UUID
            };

            // Act
            const result = AiSettingsResponseSchema.safeParse(emptyStateResponse);

            // Assert — this MUST pass; before the fix it failed with ZodError
            // on the full-record constraint, causing stripWithSchema to throw → 500.
            expect(result.success).toBe(true);
        });

        it('should ACCEPT value.features with only some features present (partial map)', () => {
            // Arrange: only one feature configured.
            const partialResponse = {
                key: 'global' as const,
                value: {
                    providers: { openai: { enabled: true } },
                    features: {
                        chat: VALID_FEATURE_CONFIG
                    }
                },
                updatedAt: VALID_DATETIME,
                updatedBy: VALID_UUID
            };

            // Act
            const result = AiSettingsResponseSchema.safeParse(partialResponse);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('valid full response', () => {
        it('should ACCEPT a complete response with all features', () => {
            // Act
            const result = AiSettingsResponseSchema.safeParse(VALID_RESPONSE);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('invalid feature config', () => {
        it('should REJECT a response where a feature config is missing required fields', () => {
            // Arrange: feature config missing `model` and `primaryProvider`.
            const invalidFeatureConfig = {
                key: 'global' as const,
                value: {
                    providers: {},
                    features: {
                        chat: {
                            enabled: true
                            // missing: primaryProvider, fallbackChain, model, params
                        }
                    }
                },
                updatedAt: VALID_DATETIME,
                updatedBy: VALID_UUID
            };

            // Act
            const result = AiSettingsResponseSchema.safeParse(invalidFeatureConfig);

            // Assert — a malformed feature entry must still be rejected.
            expect(result.success).toBe(false);
        });

        it('should REJECT a response with an unknown key in the feature config (strict)', () => {
            // Arrange: extra unknown field inside a feature entry.
            const unknownKeyInFeature = {
                key: 'global' as const,
                value: {
                    providers: {},
                    features: {
                        chat: {
                            ...VALID_FEATURE_CONFIG,
                            unknownField: 'should-fail'
                        }
                    }
                },
                updatedAt: VALID_DATETIME,
                updatedBy: VALID_UUID
            };

            // Act
            const result = AiSettingsResponseSchema.safeParse(unknownKeyInFeature);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AiSettingsValueSchema — write contract must NOT be relaxed
// ============================================================================

describe('AiSettingsValueSchema (PUT request body — write contract)', () => {
    it('should ACCEPT a complete blob with all features (happy path)', () => {
        // Act
        const result = AiSettingsValueSchema.safeParse(VALID_SETTINGS_BLOB);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should REJECT an empty features map (write contract requires all feature keys)', () => {
        // Arrange: the empty state that is valid for GET but NOT for PUT.
        const emptyFeatures = {
            providers: { openai: { enabled: true } },
            features: {}
        };

        // Act
        const result = AiSettingsValueSchema.safeParse(emptyFeatures);

        // Assert — MUST fail: admin must always save a complete config.
        expect(result.success).toBe(false);
    });

    it('should REJECT a partial features map (only some features present)', () => {
        // Arrange: only two of four features provided.
        const partialFeatures = {
            providers: { openai: { enabled: true } },
            features: {
                text_improve: VALID_FEATURE_CONFIG,
                chat: VALID_FEATURE_CONFIG
                // missing: search, support
            }
        };

        // Act
        const result = AiSettingsValueSchema.safeParse(partialFeatures);

        // Assert — MUST fail: the write schema requires all four keys.
        expect(result.success).toBe(false);
    });
});
