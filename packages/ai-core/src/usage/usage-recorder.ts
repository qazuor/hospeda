/**
 * AI usage recorder (SPEC-173 T-016).
 *
 * Orchestrates cost calculation and storage for every AI call.
 * This is the single entry-point for writing a metering row to `ai_usage`.
 *
 * **AC-4 isolation**: this module NEVER imports `@repo/db` directly.
 * All DB access goes through `../storage` (which is the only layer allowed to
 * import `@repo/db`). The `tx` parameter type is derived from
 * {@link InsertAiUsageInput} to stay in sync without a direct db import.
 *
 * @module ai-core/usage/usage-recorder
 */

import type { AiModelRate } from '@repo/schemas';
import type { InsertAiUsageInput, SelectAiUsage } from '../storage/index.js';
import { insertAiUsage } from '../storage/index.js';
import { calculateCostMicroUsd } from './cost-calculator.js';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Input for {@link recordAiUsage}.
 */
export interface RecordAiUsageInput {
    /**
     * UUID of the authenticated user who triggered the AI call.
     * `null` for system-initiated calls or when actor resolution failed.
     */
    readonly userId: string | null;
    /** AI feature that was invoked (e.g. `'text_improve'`, `'chat'`). */
    readonly feature: string;
    /** Provider that served or attempted the call (e.g. `'openai'`). */
    readonly provider: string;
    /**
     * Model identifier as returned by the provider adapter (e.g. `'gpt-4o-mini'`).
     * Used for rate lookup and stored verbatim for cost attribution.
     */
    readonly model: string;
    /** Number of input (prompt) tokens consumed. */
    readonly promptTokens: number;
    /** Number of output (completion) tokens generated. */
    readonly completionTokens: number;
    /** End-to-end latency of the AI call in milliseconds. */
    readonly latencyMs: number;
    /**
     * Call outcome: `'success'` | `'error'` | `'fallback'` | `'quota_exceeded'`
     * | `'ceiling_hit'` | `'kill_switch'`.
     */
    readonly status: string;
    /**
     * Optional per-model rate overrides sourced from `ai_settings.modelRates`.
     * Passed through to {@link calculateCostMicroUsd} for hybrid rate resolution
     * (decision A, owner-approved 2026-06-04).
     */
    readonly rateOverrides?: Readonly<Record<string, AiModelRate>>;
    /** Optional Drizzle transaction client. Falls back to `getDb()` via storage. */
    readonly tx?: InsertAiUsageInput['tx'];
}

// ---------------------------------------------------------------------------
// recordAiUsage
// ---------------------------------------------------------------------------

/**
 * Records one metering row to `ai_usage`.
 *
 * Computes cost via {@link calculateCostMicroUsd} using hybrid rate resolution
 * (in-code `MODEL_RATES` + optional `rateOverrides` from `ai_settings`), then
 * persists the row via {@link insertAiUsage}.
 *
 * This function NEVER throws due to an unknown model rate — it delegates that
 * graceful-degradation contract to the cost calculator, which returns
 * `{ costMicroUsd: 0, rated: false }` for unrecognised models.
 *
 * @param input - {@link RecordAiUsageInput}
 * @returns The inserted `ai_usage` row (includes DB-generated `id` and `createdAt`).
 *
 * @example
 * ```ts
 * const row = await recordAiUsage({
 *   userId: actor.userId,
 *   feature: 'text_improve',
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   promptTokens: 250,
 *   completionTokens: 180,
 *   latencyMs: 820,
 *   status: 'success',
 * });
 * // row.costEstimateMicroUsd === 146
 * ```
 */
export async function recordAiUsage(input: RecordAiUsageInput): Promise<SelectAiUsage> {
    const {
        userId,
        feature,
        provider,
        model,
        promptTokens,
        completionTokens,
        latencyMs,
        status,
        rateOverrides,
        tx
    } = input;

    const { costMicroUsd } = calculateCostMicroUsd({
        provider,
        model,
        promptTokens,
        completionTokens,
        rateOverrides
    });

    return insertAiUsage({
        userId,
        feature,
        provider,
        model,
        tokensIn: promptTokens,
        tokensOut: completionTokens,
        costEstimateMicroUsd: costMicroUsd,
        latencyMs,
        status,
        tx
    });
}
