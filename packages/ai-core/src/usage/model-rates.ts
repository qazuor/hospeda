/**
 * In-code default per-model cost rates (SPEC-173 T-016, decision A).
 *
 * Rates are expressed as integer µUSD (micro-USD) per 1,000,000 tokens.
 * Unit: 1 USD = 1,000,000 µUSD. USD native, no FX conversion. NEVER float.
 *
 * These defaults are the mandatory fallback — if a model is absent from both
 * this map and any `ai_settings.modelRates` override, the cost calculator
 * returns 0 with `rated: false` (metering must not throw).
 *
 * Entries here can be overridden or extended per model via the
 * `ai_settings.modelRates` config blob without requiring a redeploy
 * (decision A, owner-approved 2026-06-04).
 *
 * @module ai-core/usage/model-rates
 */

import type { AiModelRate } from '@repo/schemas';

/**
 * Default per-model cost rates, keyed by model identifier string.
 *
 * Pricing verified ~2026-06; overridable via `ai_settings.modelRates`
 * per decision A (hybrid in-code default + optional DB override).
 *
 * Rate unit: integer µUSD per 1,000,000 tokens.
 *
 * @example
 * // gpt-4o-mini: $0.15 input / $0.60 output per 1M tokens
 * MODEL_RATES['gpt-4o-mini']
 * // => { inputMicroUsdPerMillionTokens: 150_000, outputMicroUsdPerMillionTokens: 600_000 }
 */
export const MODEL_RATES: Readonly<Record<string, AiModelRate>> = {
    'gpt-4o': {
        inputMicroUsdPerMillionTokens: 2_500_000,
        outputMicroUsdPerMillionTokens: 10_000_000
    },
    'gpt-4o-mini': {
        inputMicroUsdPerMillionTokens: 150_000,
        outputMicroUsdPerMillionTokens: 600_000
    },
    'claude-3-5-sonnet-20241022': {
        inputMicroUsdPerMillionTokens: 3_000_000,
        outputMicroUsdPerMillionTokens: 15_000_000
    },
    'claude-3-5-haiku-20241022': {
        inputMicroUsdPerMillionTokens: 800_000,
        outputMicroUsdPerMillionTokens: 4_000_000
    }
} as const;
