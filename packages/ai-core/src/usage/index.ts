/**
 * AI usage tracking module (SPEC-173 T-016).
 *
 * Records token consumption, latency, model invocations, and cost estimates
 * per request. Feeds the admin observability dashboard and billing surfaces.
 *
 * Exports:
 * - `MODEL_RATES`            — in-code default per-model cost rates (µUSD/1M tokens).
 * - `calculateCostMicroUsd`  — computes call cost from token counts + rate table.
 * - `recordAiUsage`          — orchestrates cost calculation + DB persistence.
 *
 * @module ai-core/usage
 */

export { MODEL_RATES } from './model-rates.js';

export {
    calculateCostMicroUsd,
    type CalculateCostInput,
    type CalculateCostResult
} from './cost-calculator.js';

export { recordAiUsage, type RecordAiUsageInput } from './usage-recorder.js';

// Read-only usage reporting (SPEC-173 T-018)
export {
    getMonthlyUsage,
    getUsageByUser,
    getUsageByFeature,
    getUtcMonthRange,
    type GetMonthlyUsageInput,
    type GetUsageByUserInput,
    type GetUsageByFeatureInput,
    type GetUtcMonthRangeInput,
    type UtcMonthRange
} from './reporting/index.js';
