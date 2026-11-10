/**
 * Warning hook for AI models that have no cost rate (HOS-2096).
 *
 * `@repo/ai-core` cannot log, so `recordAiUsage` accepts an `onMissingRate`
 * hook. Pass {@link warnMissingModelRate}: it fires once per model per process
 * (deduped inside ai-core), so it is safe on every metered call.
 *
 * @module utils/ai-missing-model-rate
 */

import type { MissingModelRateHook } from '@repo/ai-core';
import { apiLogger } from './logger';

/**
 * Logs a structured warning that `model` has no entry in `MODEL_RATES` nor in
 * the `ai_settings.modelRates` override, so its `ai_usage` cost is recorded as
 * 0 and the monthly dollar ceiling cannot account for it.
 */
export const warnMissingModelRate: MissingModelRateHook = ({ provider, model }) => {
    apiLogger.warn(
        { provider, model },
        'ai-usage: model has no cost rate; cost_estimate_micro_usd is recorded as 0 and the monthly dollar ceiling cannot account for it (add a rate in MODEL_RATES or ai_settings.modelRates)'
    );
};
