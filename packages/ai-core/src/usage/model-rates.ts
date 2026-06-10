/**
 * In-code default per-model cost rates and monthly cost ceilings (SPEC-173 T-016, SPEC-211 T-002).
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

import type { AiCostCeilings, AiModelRate } from '@repo/schemas';

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

// ---------------------------------------------------------------------------
// Default monthly cost ceilings (SPEC-211 T-002, §6.3)
// ---------------------------------------------------------------------------

/**
 * Default monthly AI cost ceilings (SPEC-211 §6.3).
 *
 * All values are integer µUSD (micro-USD; 1 USD = 1,000,000 µUSD).
 * Total monthly platform budget: USD 100 (100_000_000 µUSD).
 *
 * These are the **last-resort backstop** — per-owner finite quotas
 * (set in `plans.config.ts`) trip first.  The ceilings here apply
 * across the entire platform regardless of which user or owner triggered
 * the AI call.
 *
 * The values are consumed by the seed that writes the initial
 * `ai_settings` row (via `writeAiSettings`) and can be read by
 * tooling that needs the canonical default for validation or smoke tests.
 * Admins can override them at runtime through the admin AI-settings UI
 * without a redeploy.
 *
 * Decision (SPEC-211, owner-approved 2026-06-09): in-code constant
 * following the same pattern as {@link MODEL_RATES} — a typed, exported
 * constant that doubles as the seed default and the documented source of
 * truth.  A schema `.default()` was not used because `AiCostCeilingsSchema`
 * is already `.optional()` on the blob and Zod `.default()` on an optional
 * nested object creates confusing two-layer optionality.  A seed-only value
 * was rejected because no `ai_settings` seed exists yet; baking the values
 * here keeps them reachable by tests and future seeds without inventing new
 * seed infrastructure.
 *
 * @example
 * ```ts
 * import { DEFAULT_COST_CEILINGS } from '@repo/ai-core';
 * // globalMonthlyMicroUsd === 100_000_000  → USD 100
 * // perFeatureMonthlyMicroUsd.chat         → USD 45
 * // perFeatureMonthlyMicroUsd.search       → USD 30
 * // perFeatureMonthlyMicroUsd.text_improve → USD 15
 * // perFeatureMonthlyMicroUsd.support      → USD 10
 * ```
 */
export const DEFAULT_COST_CEILINGS: Readonly<AiCostCeilings> = {
    /**
     * Global monthly spend ceiling: USD 100.
     * When cumulative platform spend reaches this value, ALL AI calls
     * are hard-stopped until the ceiling resets or an admin raises it.
     */
    globalMonthlyMicroUsd: 100_000_000,
    /**
     * Per-feature monthly ceilings (µUSD).
     * Total of per-feature values equals the global ceiling (USD 100).
     */
    perFeatureMonthlyMicroUsd: {
        /** USD 45 / month for the AI chat feature. */
        chat: 45_000_000,
        /** USD 30 / month for the AI search feature. */
        search: 30_000_000,
        /** USD 15 / month for the AI text-improve feature. */
        text_improve: 15_000_000,
        /** USD 10 / month for the AI support feature. */
        support: 10_000_000
    }
} as const;
