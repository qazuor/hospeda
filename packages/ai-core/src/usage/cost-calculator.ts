/**
 * AI call cost calculator (SPEC-173 T-016).
 *
 * Computes the estimated cost of one AI call in integer µUSD (micro-USD).
 * Unit: 1 USD = 1,000,000 µUSD. USD native, no FX conversion. NEVER float.
 *
 * Rate resolution order (decision A — hybrid in-code + optional DB override):
 *   1. `rateOverrides[model]` — from `ai_settings.modelRates` (DB-stored, no redeploy).
 *   2. `MODEL_RATES[model]`   — in-code default (mandatory fallback).
 *   3. If neither exists → `{ costMicroUsd: 0, rated: false }` (never throws).
 *
 * @module ai-core/usage/cost-calculator
 */

import type { AiModelRate } from '@repo/schemas';
import { MODEL_RATES } from './model-rates.js';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/**
 * Input for {@link calculateCostMicroUsd}.
 */
export interface CalculateCostInput {
    /** Provider that served the call (e.g. `'openai'`). Currently unused in rate lookup but kept for future per-provider rate tables. */
    readonly provider: string;
    /** Model identifier string (e.g. `'gpt-4o-mini'`). Used as the rate lookup key. */
    readonly model: string;
    /** Number of input (prompt) tokens consumed. */
    readonly promptTokens: number;
    /** Number of output (completion) tokens generated. */
    readonly completionTokens: number;
    /**
     * Optional per-model rate overrides sourced from `ai_settings.modelRates`.
     * When provided, a matching entry takes precedence over the in-code default
     * `MODEL_RATES` for the given model (decision A, owner-approved 2026-06-04).
     */
    readonly rateOverrides?: Readonly<Record<string, AiModelRate>>;
}

/**
 * Result of {@link calculateCostMicroUsd}.
 */
export interface CalculateCostResult {
    /**
     * Estimated cost of the call in integer µUSD (micro-USD).
     * Zero when no rate was found for the model (`rated: false`).
     */
    readonly costMicroUsd: number;
    /**
     * `true` when a rate was found (either from `rateOverrides` or `MODEL_RATES`).
     * `false` when the model is unrecognised and cost is an untracked zero.
     * Callers MAY log a warning when `rated: false` to surface missing rate entries.
     */
    readonly rated: boolean;
}

// ---------------------------------------------------------------------------
// calculateCostMicroUsd
// ---------------------------------------------------------------------------

/**
 * Computes the estimated cost of one AI call in integer µUSD (micro-USD).
 *
 * **Never throws** — missing model rate returns `{ costMicroUsd: 0, rated: false }`
 * so that the metering path can never break a user-facing request.
 *
 * Formula:
 * ```
 * cost = round(
 *   promptTokens     * rate.inputMicroUsdPerMillionTokens  / 1_000_000
 *   + completionTokens * rate.outputMicroUsdPerMillionTokens / 1_000_000
 * )
 * ```
 *
 * @param input - {@link CalculateCostInput}
 * @returns {@link CalculateCostResult}
 *
 * @example
 * // gpt-4o-mini: 250 input + 180 output tokens
 * // inputCost  = 250 * 150_000 / 1_000_000 =  37.5
 * // outputCost = 180 * 600_000 / 1_000_000 = 108.0
 * // total      = round(37.5 + 108.0)       = 146 µUSD
 * calculateCostMicroUsd({
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   promptTokens: 250,
 *   completionTokens: 180,
 * });
 * // => { costMicroUsd: 146, rated: true }
 */
export function calculateCostMicroUsd(input: CalculateCostInput): CalculateCostResult {
    const { model, promptTokens, completionTokens, rateOverrides } = input;

    const rate: AiModelRate | undefined = rateOverrides?.[model] ?? MODEL_RATES[model];

    if (rate === undefined) {
        return { costMicroUsd: 0, rated: false };
    }

    const costMicroUsd = Math.round(
        (promptTokens * rate.inputMicroUsdPerMillionTokens) / 1_000_000 +
            (completionTokens * rate.outputMicroUsdPerMillionTokens) / 1_000_000
    );

    return { costMicroUsd, rated: true };
}
