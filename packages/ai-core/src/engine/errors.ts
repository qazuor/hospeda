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
 *         ├── AiEngineExhaustedError   (all providers failed, AC-2)
 *         ├── AiCeilingHitError        (cost ceiling breached, AC-8, T-017)
 *         └── AiNoEnabledProviderError (all providers kill-switched off, T-017)
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

// ---------------------------------------------------------------------------
// Cost-ceiling error (AC-8, T-017)
// ---------------------------------------------------------------------------

/**
 * Thrown when accumulated AI spend for the current calendar month has reached
 * or exceeded the configured ceiling (AC-8, SPEC-173 T-017).
 *
 * The engine propagates this error without retrying any provider — a ceiling
 * breach is a hard stop until the admin raises the limit or the month resets.
 *
 * `scope` distinguishes global breaches from per-feature breaches so callers
 * can produce accurate user-facing messages and metrics labels.
 *
 * @example
 * ```ts
 * try {
 *   await engine.generateText({ feature: 'chat', ... });
 * } catch (err) {
 *   if (err instanceof AiCeilingHitError) {
 *     logger.warn('AI cost ceiling hit', {
 *       scope: err.scope,
 *       feature: err.feature,
 *       spent: err.spentMicroUsd,
 *       ceiling: err.ceilingMicroUsd,
 *     });
 *     return { error: 'AI service temporarily suspended (cost limit reached).' };
 *   }
 * }
 * ```
 */
export class AiCeilingHitError extends AiEngineError {
    /**
     * Whether the ceiling that was breached is the global monthly ceiling or a
     * per-feature ceiling.
     */
    readonly scope: 'global' | 'feature';

    /**
     * The specific AI feature whose spend triggered a per-feature ceiling.
     * Only set when `scope === 'feature'`; `undefined` for global ceiling hits.
     */
    readonly feature: AiFeature | undefined;

    /** Accumulated spend for the current month in integer µUSD. */
    readonly spentMicroUsd: number;

    /** The configured ceiling value in integer µUSD. */
    readonly ceilingMicroUsd: number;

    constructor(input: {
        readonly scope: 'global' | 'feature';
        readonly feature?: AiFeature;
        readonly spentMicroUsd: number;
        readonly ceilingMicroUsd: number;
    }) {
        const { scope, feature, spentMicroUsd, ceilingMicroUsd } = input;
        const scopeLabel =
            scope === 'feature' && feature !== undefined ? `per-feature ('${feature}')` : 'global';
        super(
            `AI cost ceiling hit (${scopeLabel}): spent ${spentMicroUsd} µUSD >= ceiling ${ceilingMicroUsd} µUSD this calendar month.`,
            'CEILING_HIT'
        );
        this.name = 'AiCeilingHitError';
        this.scope = scope;
        this.feature = feature;
        this.spentMicroUsd = spentMicroUsd;
        this.ceilingMicroUsd = ceilingMicroUsd;
    }
}

// ---------------------------------------------------------------------------
// No-enabled-provider error (T-017)
// ---------------------------------------------------------------------------

/**
 * Thrown when every provider in a feature's routing chain (primary +
 * fallback) has been filtered out because their `config.providers[id].enabled`
 * is `false` (T-017 provider kill-switch, SPEC-173).
 *
 * This is distinct from `AiEngineExhaustedError` (which means providers were
 * tried but all failed at the network / API level). Here, no provider was
 * called at all — they were all administratively disabled.
 *
 * The condition is: a provider id exists in the providers config map AND its
 * `enabled` field is `false`. Provider ids that have NO entry in the map are
 * NOT skipped (preserving the original routing behaviour so existing tests
 * remain green).
 *
 * @example
 * ```ts
 * try {
 *   await engine.generateText({ feature: 'text_improve', ... });
 * } catch (err) {
 *   if (err instanceof AiNoEnabledProviderError) {
 *     return { error: `All AI providers for '${err.feature}' are currently disabled.` };
 *   }
 * }
 * ```
 */
export class AiNoEnabledProviderError extends AiEngineError {
    /** The feature for which no enabled provider could be found. */
    readonly feature: AiFeature;

    constructor(feature: AiFeature) {
        super(
            `No enabled AI provider available for feature '${feature}': every provider in the routing chain has been disabled via config.providers[id].enabled = false. Enable at least one provider to restore the feature.`,
            'NO_ENABLED_PROVIDER'
        );
        this.name = 'AiNoEnabledProviderError';
        this.feature = feature;
    }
}
