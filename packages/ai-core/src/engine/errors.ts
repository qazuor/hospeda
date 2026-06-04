/**
 * Typed error classes for the AI routing engine (SPEC-173 §5.3, T-014).
 *
 * All engine-level failures are expressed through these classes so callers can
 * use `instanceof` guards and the TypeScript type system to discriminate error
 * kinds without inspecting untyped string messages.
 *
 * **Error hierarchy**:
 * ```
 * Error
 *   └── AiEngineError          (base, adds engineCode)
 *         ├── AiFeatureDisabledError   (kill-switch active, AC-9)
 *         └── AiEngineExhaustedError   (all providers failed, AC-2)
 * ```
 *
 * `AiFeatureNotConfiguredError` (from the config resolver) is NOT re-exported
 * here — it is an infrastructure-level error thrown before the engine even
 * attempts routing and is already exported from `../config/index.js`.
 *
 * @module ai-core/engine/errors
 */

import type { AiFeature, AiProviderId } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Base engine error
// ---------------------------------------------------------------------------

/**
 * Base class for all errors originating inside the AI routing engine.
 *
 * Every engine error carries a stable `engineCode` string that callers can
 * switch on without relying on the human-readable `message`.
 */
export class AiEngineError extends Error {
    /**
     * Stable machine-readable error code.
     * Values are defined by each subclass (e.g. `'FEATURE_DISABLED'`).
     */
    readonly engineCode: string;

    constructor(message: string, engineCode: string) {
        super(message);
        this.name = 'AiEngineError';
        this.engineCode = engineCode;
    }
}

// ---------------------------------------------------------------------------
// Kill-switch error (AC-9)
// ---------------------------------------------------------------------------

/**
 * Thrown when the engine is asked to route a call for a feature whose
 * kill-switch is active (`AiFeatureConfig.enabled === false`).
 *
 * The engine throws this immediately — NO provider is called and NO retry is
 * attempted. This implements AC-9: an admin-toggled kill-switch takes effect
 * for ALL users without a redeploy.
 *
 * @example
 * ```ts
 * try {
 *   await engine.generateText({ feature: 'chat', ... });
 * } catch (err) {
 *   if (err instanceof AiFeatureDisabledError) {
 *     return { error: `AI ${err.feature} is currently disabled.` };
 *   }
 * }
 * ```
 */
export class AiFeatureDisabledError extends AiEngineError {
    /** The feature that was disabled by the kill-switch. */
    readonly feature: AiFeature;

    constructor(feature: AiFeature) {
        super(
            `AI feature '${feature}' is currently disabled by an admin kill-switch (enabled: false). No providers were called.`,
            'FEATURE_DISABLED'
        );
        this.name = 'AiFeatureDisabledError';
        this.feature = feature;
    }
}

// ---------------------------------------------------------------------------
// All-providers-exhausted error (AC-2)
// ---------------------------------------------------------------------------

/**
 * Details of a single provider attempt that failed during routing.
 *
 * Aggregated into `AiEngineExhaustedError.attempts` so callers and logging
 * pipelines (T-016/T-018) have full visibility into what was tried.
 */
export interface ProviderAttempt {
    /** The provider that was attempted. */
    readonly providerId: AiProviderId;
    /** The final error from that provider (after all retries, if retryable). */
    readonly error: Error;
    /** Number of times this provider was called (1 = no retries attempted). */
    readonly callCount: number;
    /** Whether the error was classified as retryable. */
    readonly wasRetryable: boolean;
}

/**
 * Thrown when every provider in the routing chain (primary + entire fallback
 * chain) has been tried and all have failed (AC-2).
 *
 * The `attempts` array records exactly what was tried, how many times, and
 * what error each provider produced. The `lastError` shortcut is the error
 * from the final provider tried (most likely to be the most informative for
 * logging).
 *
 * @example
 * ```ts
 * try {
 *   await engine.generateText({ feature: 'text_improve', ... });
 * } catch (err) {
 *   if (err instanceof AiEngineExhaustedError) {
 *     logger.error('All AI providers failed', { attempts: err.attempts });
 *     return { error: 'AI service temporarily unavailable.' };
 *   }
 * }
 * ```
 */
export class AiEngineExhaustedError extends AiEngineError {
    /** The feature that triggered the routing attempt. */
    readonly feature: AiFeature;

    /**
     * The ordered list of provider attempts, one entry per provider tried.
     * Index 0 is the primary provider; subsequent indices are fallbacks.
     */
    readonly attempts: readonly ProviderAttempt[];

    /**
     * Shortcut to the last error in `attempts`.
     * Useful for log aggregation when you only want the final failure reason.
     */
    readonly lastError: Error;

    constructor(feature: AiFeature, attempts: readonly ProviderAttempt[]) {
        const providerIds = attempts.map((a) => a.providerId).join(' → ');
        super(
            `All AI providers exhausted for feature '${feature}'. Tried: ${providerIds}. ${attempts.length} attempt(s) failed.`,
            'ENGINE_EXHAUSTED'
        );
        this.name = 'AiEngineExhaustedError';
        this.feature = feature;
        this.attempts = attempts;
        // Safe: the engine only creates this error when at least one provider
        // was tried; `attempts` is always non-empty here.
        this.lastError = attempts[attempts.length - 1]?.error ?? new Error('unknown');
    }
}
