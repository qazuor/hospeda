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

// Cost-ceiling check (SPEC-173 T-017)
export {
    type CheckCostCeilingInput,
    checkCostCeiling,
    type ThresholdAlertHook,
    type ThresholdAlertInput
} from './ceiling.js';

export {
    type CalculateCostInput,
    type CalculateCostResult,
    calculateCostMicroUsd
} from './cost-calculator.js';
export { DEFAULT_COST_CEILINGS, MODEL_RATES } from './model-rates.js';
// Read-only usage reporting (SPEC-173 T-018)
// Monthly call-count helper for quota enforcement (SPEC-173 T-031)
// SPEC-260: new reporting wrappers — byModel, byProvider, byFeatureModel, daily
export {
    type GetDailyUsageInput,
    type GetMonthlyCallCountInput,
    type GetMonthlyUsageInput,
    type GetUsageByFeatureInput,
    type GetUsageByFeatureModelInput,
    type GetUsageByModelInput,
    type GetUsageByProviderInput,
    type GetUsageByUserInput,
    type GetUtcMonthRangeInput,
    getDailyUsage,
    getMonthlyCallCount,
    getMonthlyUsage,
    getUsageByFeature,
    getUsageByFeatureModel,
    getUsageByModel,
    getUsageByProvider,
    getUsageByUser,
    getUtcMonthRange,
    type UtcMonthRange
} from './reporting/index.js';
export { type RecordAiUsageInput, recordAiUsage } from './usage-recorder.js';
