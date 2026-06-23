/**
 * AI usage reporting public API (SPEC-173 T-018).
 *
 * Exports the orchestration functions and their input/output types.
 *
 * AC-4: this barrel re-exports from modules that NEVER import `@repo/db`.
 *
 * @module ai-core/usage/reporting
 */

export {
    getMonthlyUsage,
    getUsageByUser,
    getUsageByFeature,
    getUsageByModel,
    getUsageByProvider,
    getUsageByFeatureModel,
    getDailyUsage,
    type GetMonthlyUsageInput,
    type GetUsageByUserInput,
    type GetUsageByFeatureInput,
    type GetUsageByModelInput,
    type GetUsageByProviderInput,
    type GetUsageByFeatureModelInput,
    type GetDailyUsageInput
} from './usage-reporting.js';

export {
    getUtcMonthRange,
    type GetUtcMonthRangeInput,
    type UtcMonthRange
} from './month-range.js';

// Monthly call-count helper for quota enforcement (SPEC-173 T-031)
export {
    getMonthlyCallCount,
    type GetMonthlyCallCountInput
} from './monthly-call-count.js';
