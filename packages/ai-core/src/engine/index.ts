/**
 * AI execution engine module (SPEC-173 §5.3, T-014).
 *
 * Orchestrates kill-switch checks, provider dispatch, retries, fallback
 * routing, and event recording across all AI capabilities.
 *
 * ### Public API
 *
 * - **`createAiEngine()`** — factory that returns an {@link AiEngine} instance
 *   configured with an injected provider factory, optional event sink, and
 *   optional V2 provider-order strategy.
 * - **`AiEngine`** — interface exposing `generateText`, `streamText`,
 *   `generateObject`, `extractIntent`, `moderate`.
 * - **`AiFeatureDisabledError`** — thrown when a feature kill-switch is active.
 * - **`AiEngineExhaustedError`** — thrown when all providers in the chain fail.
 * - **`AiEngineError`** — base class for all engine errors.
 * - **`defaultProviderOrderStrategy`** — config-order strategy (V2 seam default).
 * - **`isRetryableError`** — error-classification helper (exported for tests).
 *
 * @module ai-core/engine
 */

export { createAiEngine, defaultProviderOrderStrategy } from './engine.js';
export type {
    AiEngine,
    AiEngineEvent,
    AiEngineFallbackEvent,
    AiEngineExhaustedEvent,
    AiEngineKillSwitchEvent,
    AiEngineSuccessEvent,
    CreateAiEngineInput,
    ProviderOrderStrategy,
    ProviderOrderStrategyInput
} from './engine.js';

export { AiEngineError, AiEngineExhaustedError, AiFeatureDisabledError } from './errors.js';
export type { ProviderAttempt } from './errors.js';

export {
    isRetryableError,
    withRetry,
    MAX_ATTEMPTS_PER_PROVIDER,
    RETRY_BASE_DELAY_MS,
    sleep
} from './retry.js';
export type { WithRetryInput } from './retry.js';
