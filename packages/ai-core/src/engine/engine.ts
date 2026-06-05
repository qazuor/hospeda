/**
 * AI routing engine — provider dispatch, fallback, and kill-switch (SPEC-173 §5.3, T-014).
 *
 * ## Responsibilities
 *
 * 1. **Kill-switch check** (AC-9): before touching any provider, checks
 *    `featureConfig.enabled`. Throws `AiFeatureDisabledError` immediately if false.
 * 2. **Provider routing** (AC-2): resolves the ordered provider list
 *    `[primaryProvider, ...fallbackChain]` from the feature config.
 * 3. **Retry per provider**: uses `withRetry` to retry retryable errors on the
 *    SAME provider up to `MAX_ATTEMPTS_PER_PROVIDER` times before moving on.
 * 4. **Fallback**: on final failure for a provider, moves to the next provider
 *    in the chain and records a fallback event via the injected `recordEvent` sink.
 * 5. **Exhaustion** (AC-2): if all providers fail, throws `AiEngineExhaustedError`
 *    with full attempt diagnostics.
 *
 * ## Provider injection (§12 flag)
 *
 * // Decision (owner-approved 2026-06-04): The engine receives providers via an
 * // injected factory `getProvider: (id: AiProviderId) => AiProvider`.
 * // Rationale: the engine MUST NOT construct adapters with API keys itself —
 * // key decryption from the vault (`ai_provider_credentials`) is done in
 * // `apps/api` (T-043) at request time. The factory pattern keeps the engine
 * // credential-free and testable. T-043 will wire the real adapters at the
 * // Hono app-startup layer.
 *
 * ## Event recording (§12 flag)
 *
 * // Decision (owner-approved 2026-06-04): Fallback and failure events are emitted
 * // through an injected `recordEvent?` callback. The engine does NOT write to
 * // `ai_usage`, Sentry, or any log sink directly — that wiring lives in
 * // T-016 (usage recording), T-018 (Sentry), and T-035 (billing metering).
 * // The sink receives typed `AiEngineEvent` objects; the injected callback in
 * // T-043 will fan them out.
 *
 * ## V2 routing seam
 *
 * Provider selection is performed by a pluggable `selectProviderOrder` strategy.
 * The default strategy reads the config-defined order (primary + fallback chain).
 * A V2 cost-based / A-B / ensemble strategy can replace it by passing a custom
 * `selectProviderOrder` to `createAiEngine` — the public engine API (`generateText`,
 * `streamText`, etc.) is UNCHANGED by swapping the strategy. See
 * `ProviderOrderStrategy` below.
 *
 * ## Moderation routing (§12 flag)
 *
 * // Decision (owner-approved 2026-06-04): `moderate` does NOT use the standard
 * // feature-config routing because `ModerateRequest` has no `feature` field
 * // (it is a lower-level primitive). The engine routes moderation calls directly
 * // to the configured `moderationProviderId` (default 'openai', since OpenAI
 * // Moderation API is a first-class endpoint). The caller passes an explicit
 * // `moderationProviderId` to `createAiEngine`; if absent, the engine uses 'openai'.
 *
 * @module ai-core/engine/engine
 */

import type {
    AiFeature,
    AiIntent,
    AiProviderId,
    ExtractIntentRequest,
    GenerateObjectRequest,
    GenerateObjectResponseMeta,
    GenerateTextRequest,
    GenerateTextResponse,
    ModerateRequest,
    ModerateResponse,
    StreamTextRequest
} from '@repo/schemas';
import type { AiFeatureConfig } from '@repo/schemas';
import type { ZodType } from 'zod';
import {
    getProviderOrder,
    isFeatureKillSwitched,
    resolveConfig,
    resolveFeatureConfig
} from '../config/resolver.js';
import type { AiProvider, StreamTextResult } from '../providers/ai-provider.interface.js';
import {
    AiEngineExhaustedError,
    AiFeatureDisabledError,
    AiNoEnabledProviderError
} from './errors.js';
import type { ProviderAttempt } from './errors.js';
import { buildInputModerationText, runModerationPass } from './moderation-pass.js';
import { MAX_ATTEMPTS_PER_PROVIDER, isRetryableError, withRetry } from './retry.js';

// ---------------------------------------------------------------------------
// Engine event types (emitted via the injected recordEvent sink)
// ---------------------------------------------------------------------------

/**
 * A provider call succeeded on the first try (primary, no fallback).
 */
export interface AiEngineSuccessEvent {
    readonly type: 'success';
    readonly feature: AiFeature;
    readonly providerId: AiProviderId;
}

/**
 * A provider failed and the engine is falling back to the next provider.
 *
 * Emitted once per provider transition, NOT once per retry attempt within a
 * single provider's retry budget.
 */
export interface AiEngineFallbackEvent {
    readonly type: 'fallback';
    readonly feature: AiFeature;
    readonly fromProvider: AiProviderId;
    readonly toProvider: AiProviderId;
    /** The final error from `fromProvider` (after exhausting its retry budget). */
    readonly error: Error;
}

/**
 * All providers failed — the engine is about to throw `AiEngineExhaustedError`.
 */
export interface AiEngineExhaustedEvent {
    readonly type: 'exhausted';
    readonly feature: AiFeature;
    readonly attempts: readonly ProviderAttempt[];
}

/**
 * A kill-switch was active and the engine refused to route the request.
 */
export interface AiEngineKillSwitchEvent {
    readonly type: 'kill_switch';
    readonly feature: AiFeature;
}

/**
 * The content-moderation pass flagged either the input or the output of a
 * capability call (T-020).
 *
 * Emitted immediately before `AiModerationBlockedError` is thrown so the event
 * sink can record the block before the error propagates to the caller.
 */
export interface AiEngineModerationBlockedEvent {
    readonly type: 'moderation_blocked';
    /** The feature whose call was blocked. */
    readonly feature: AiFeature;
    /** Whether the block was on the user input or the generated output. */
    readonly direction: 'input' | 'output';
    /**
     * Per-category boolean flags from the moderation provider.
     * Keys are provider-defined category names (e.g. `'hate'`, `'violence'`).
     */
    readonly categories: Record<string, boolean>;
}

/**
 * The moderation provider itself threw an error (network failure, provider
 * down, unconfigured provider, etc.) and the call is continuing unmoderated
 * (fail-open — T-020).
 */
export interface AiEngineModerationErrorEvent {
    readonly type: 'moderation_error';
    /** The feature whose call triggered the failed moderation attempt. */
    readonly feature: AiFeature;
    /** Whether the error occurred during the input or the output pass. */
    readonly direction: 'input' | 'output';
    /** Human-readable error message from the moderation provider. */
    readonly errorMessage: string;
}

/**
 * Union of all events emitted by the engine via `recordEvent`.
 *
 * The injected sink (T-016/T-018/T-035) receives one of these per routing
 * decision. Callers should use exhaustive `switch (event.type)` to handle
 * each variant.
 */
export type AiEngineEvent =
    | AiEngineSuccessEvent
    | AiEngineFallbackEvent
    | AiEngineExhaustedEvent
    | AiEngineKillSwitchEvent
    | AiEngineModerationBlockedEvent
    | AiEngineModerationErrorEvent;

// ---------------------------------------------------------------------------
// Provider-order strategy (V2 seam)
// ---------------------------------------------------------------------------

/**
 * Input for the provider-order selection strategy.
 */
export interface ProviderOrderStrategyInput {
    /** The feature being routed. */
    readonly feature: AiFeature;
    /** The resolved feature configuration. */
    readonly featureConfig: AiFeatureConfig;
}

/**
 * A strategy function that returns the ordered list of provider IDs to try.
 *
 * **V2 seam**: the default implementation reads `primaryProvider` +
 * `fallbackChain` from the feature config (config-order strategy). A future
 * cost-based, A/B, or ensemble strategy replaces ONLY this function — the
 * public engine methods (`generateText`, `streamText`, etc.) are unchanged.
 *
 * @param input - The feature + its resolved config.
 * @returns Ordered provider IDs, index 0 = first to try.
 */
export type ProviderOrderStrategy = (input: ProviderOrderStrategyInput) => readonly AiProviderId[];

/**
 * Default strategy: reads the provider order from the feature config
 * (primaryProvider first, then fallbackChain in order).
 *
 * This is the V1 implementation. A V2 strategy can replace it at
 * `createAiEngine({ selectProviderOrder: myStrategy })`.
 *
 * @param input - {@link ProviderOrderStrategyInput}
 * @returns Ordered provider IDs from the feature config.
 */
export function defaultProviderOrderStrategy(
    input: ProviderOrderStrategyInput
): readonly AiProviderId[] {
    const { providers } = getProviderOrder({ featureConfig: input.featureConfig });
    return providers as readonly AiProviderId[];
}

// ---------------------------------------------------------------------------
// Engine factory input
// ---------------------------------------------------------------------------

/**
 * Input for {@link createAiEngine}.
 */
export interface CreateAiEngineInput {
    /**
     * Factory function that returns a pre-constructed `AiProvider` for the
     * given `AiProviderId`.
     *
     * **Credential injection**: the factory is called at request routing time.
     * The caller (T-043, `apps/api`) constructs concrete adapters with decrypted
     * API keys from the vault and hands them to the engine via this factory.
     * The engine itself never imports `@repo/db`, never reads env vars, and never
     * touches API keys directly.
     *
     * * **Decision (owner-approved 2026-06-04):** The factory-per-request pattern
     * is used (vs. a pre-built `Map<AiProviderId, AiProvider>`). The factory is
     * simpler to test and allows T-043 to decrypt keys on demand; a pre-built map
     * would require eager decryption of all provider credentials.
     *
     * @param providerId - Which provider to return.
     * @returns A ready-to-call `AiProvider` instance.
     * @throws If the provider ID is not available in the current environment.
     */
    readonly getProvider: (providerId: AiProviderId) => AiProvider;

    /**
     * Optional event sink for routing decisions (fallbacks, exhaustion,
     * kill-switch activations, success).
     *
     * When provided, the engine calls it synchronously (fire-and-forget) for
     * each routing event. The sink MUST NOT throw — the engine does not await
     * it and will not catch exceptions from it. If the sink needs to do async
     * work (e.g. write to `ai_usage`), it should enqueue the work internally.
     *
     * When absent, routing events are silently dropped.
     *
     * * **Decision (owner-approved 2026-06-04):** Events are recorded fire-and-forget
     * (not awaited). Fire-and-forget keeps the hot path fast and avoids event-recording
     * failures from blocking the user response. T-016 will implement the actual sink.
     */
    readonly recordEvent?: (event: AiEngineEvent) => void;

    /**
     * Optional provider-order strategy override (V2 seam).
     *
     * Defaults to {@link defaultProviderOrderStrategy} (config-order).
     * A V2 cost-based or A/B strategy replaces only this function; all engine
     * capability methods are unaffected.
     */
    readonly selectProviderOrder?: ProviderOrderStrategy;

    /**
     * Optional explicit provider ID to use for `moderate` calls.
     *
     * `moderate` has no `feature` field in its request schema, so it cannot
     * use the standard feature-config routing. The engine routes moderation
     * calls to this provider directly.
     *
     * Defaults to `'openai'` when absent.
     *
     * * **Decision (owner-approved 2026-06-04):** Moderation routes directly to
     * `moderationProviderId` (default 'openai'). No 'moderation' entry is added
     * to AiFeature. This keeps the V1 implementation simple; a future provider
     * supporting moderation may be wired through feature-config in V2.
     */
    readonly moderationProviderId?: AiProviderId;

    /**
     * Optional cost-ceiling check hook (T-017, AC-8).
     *
     * When provided, the engine calls `await checkCeiling({ feature, now })`
     * BEFORE invoking any provider (after the feature kill-switch check).
     * If it throws — typically `AiCeilingHitError` — the error propagates
     * directly to the caller without retrying or falling back.
     *
     * When absent (the default for all existing tests), the ceiling check is
     * simply skipped so no existing tests are affected.
     *
     * **`now` threading**: the engine pairs this hook with `getNow`. When both
     * are provided the engine calls `await checkCeiling({ feature, now: getNow() })`
     * before routing each call.  `apps/api` (T-043) supplies both fields from
     * the request context.  When either is absent the ceiling check is skipped
     * for that call.
     *
     * * **Decision (owner-approved 2026-06-04):** The ceiling hook is AWAITED
     * (unlike the fire-and-forget `recordEvent`), because a ceiling breach MUST
     * block the call — it is a control-flow concern, not a side-effect.
     * It lives in `usage/ceiling.ts` which accesses accumulated spend via
     * `aggregateAiUsageByMonth` (storage layer only, no direct `@repo/db` import
     * inside the engine — AC-4).
     */
    readonly checkCeiling?: (input: {
        readonly feature: AiFeature;
        readonly now: Date;
    }) => Promise<void>;

    /**
     * Optional clock factory that supplies the current instant for ceiling checks.
     *
     * The engine calls `getNow()` once per capability call when `checkCeiling` is
     * also set. This keeps `now` out of the schema request types and avoids
     * making `checkCeiling` responsible for capturing the clock itself.
     *
     * `apps/api` (T-043) wires this as `() => new Date()` (or a request-scoped
     * timestamp) when it injects `checkCeiling`.  Tests that do not test ceiling
     * behaviour omit both fields and are unaffected.
     *
     * When absent, the ceiling check is silently skipped (same as when
     * `checkCeiling` is absent).
     */
    readonly getNow?: () => Date;
}

// ---------------------------------------------------------------------------
// Public engine interface
// ---------------------------------------------------------------------------

/**
 * The public API of the AI routing engine.
 *
 * Each method corresponds to one `AiProvider` capability and routes it through
 * the kill-switch check, retry policy, and fallback chain defined by the
 * feature config.
 *
 * Concrete engine instances are created via {@link createAiEngine}.
 */
export interface AiEngine {
    /**
     * Routes a `generateText` call through the feature's provider chain.
     *
     * @param input - The `generateText` request (feature, locale, prompt or messages).
     * @returns The response from the first provider that succeeds.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     * @throws Non-retryable provider errors are re-thrown immediately without fallback.
     */
    generateText(input: GenerateTextRequest): Promise<GenerateTextResponse>;

    /**
     * Routes a `streamText` call through the feature's provider chain.
     *
     * @param input - The `streamText` request (feature, locale, prompt or messages).
     * @returns A `StreamTextResult` from the first provider that succeeds.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     * @throws Non-retryable provider errors are re-thrown immediately without fallback.
     */
    streamText(input: StreamTextRequest): Promise<StreamTextResult>;

    /**
     * Routes a `generateObject` call through the feature's provider chain.
     *
     * @param input - The `generateObject` request (feature, locale, prompt).
     * @param outputSchema - Zod schema for the structured output type `T`.
     * @returns The structured object merged with usage metadata.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     * @throws Non-retryable provider errors are re-thrown immediately without fallback.
     */
    generateObject<T>(
        input: GenerateObjectRequest,
        outputSchema: ZodType<T>
    ): Promise<{ object: T } & GenerateObjectResponseMeta>;

    /**
     * Routes an `extractIntent` call through the feature's provider chain.
     *
     * `extractIntent` is an engine-internal primitive used by `search` and `chat`
     * features. The `feature` in the request determines which provider chain to use.
     *
     * @param input - The `extractIntent` request (query, optional locale).
     * @param feature - The AI feature context for routing (e.g. `'search'`).
     * @returns The extracted intent envelope.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     * @throws Non-retryable provider errors are re-thrown immediately without fallback.
     */
    extractIntent(input: ExtractIntentRequest, feature: AiFeature): Promise<AiIntent>;

    /**
     * Routes a `moderate` call to the configured moderation provider.
     *
     * Moderation bypasses the standard feature-config routing (it has no
     * `feature` field in the request). The provider is determined by
     * `moderationProviderId` passed to {@link createAiEngine}.
     *
     * @param input - The `moderate` request (input text, optional locale).
     * @returns The normalized moderation response.
     * @throws If the moderation provider call fails (no fallback in V1).
     */
    moderate(input: ModerateRequest): Promise<ModerateResponse>;
}

// ---------------------------------------------------------------------------
// Internal routing helpers
// ---------------------------------------------------------------------------

/**
 * Filters an ordered provider list by removing any provider whose
 * `config.providers[id].enabled` is explicitly `false`.
 *
 * **Only skip when an entry EXISTS and `enabled === false`.**  A provider id
 * with NO entry in the providers map is kept in the chain — this preserves the
 * existing routing behaviour (all current tests pass providers without explicit
 * config map entries and must not be affected).
 *
 * Decision (owner-approved 2026-06-04): provider kill-switch uses SKIP
 * semantics; if skipping empties the chain the caller throws
 * `AiNoEnabledProviderError`.
 *
 * @param providers - Ordered provider IDs from the strategy.
 * @param providersConfig - The `config.providers` partial map from `resolveConfig`.
 * @returns Filtered list with explicitly-disabled providers removed.
 */
function filterDisabledProviders(
    providers: readonly AiProviderId[],
    providersConfig: Record<string, { readonly enabled: boolean } | undefined>
): readonly AiProviderId[] {
    return providers.filter((id) => {
        const entry = providersConfig[id];
        // Only skip when the entry EXISTS and enabled is explicitly false.
        // Missing entries (undefined) are NOT skipped.
        return entry === undefined || entry.enabled !== false;
    });
}

/**
 * Core routing loop: resolve provider order, filter disabled providers,
 * try each remaining provider with retry policy, emit fallback events,
 * throw on exhaustion.
 *
 * This function is the heart of the engine. All capability methods delegate
 * to it — the only thing that varies per capability is the `call` lambda.
 *
 * @param feature - The feature being routed (for error messages and events).
 * @param featureConfig - The resolved feature config (provider order + model).
 * @param call - Lambda that calls one specific method on `provider`.
 * @param getProvider - Provider factory (injected from engine options).
 * @param selectProviderOrder - Strategy to determine provider order.
 * @param recordEvent - Optional event sink.
 * @param providersConfig - The `config.providers` map for kill-switch filtering.
 * @returns The result from the first provider that succeeds.
 * @throws {AiNoEnabledProviderError} When all providers are disabled via kill-switch.
 * @throws {AiEngineExhaustedError} When all (non-disabled) providers fail.
 * @throws Non-retryable errors from any provider (without fallback).
 */
async function routeWithFallback<T>(
    feature: AiFeature,
    featureConfig: AiFeatureConfig,
    call: (provider: AiProvider) => Promise<T>,
    getProvider: (id: AiProviderId) => AiProvider,
    selectProviderOrder: ProviderOrderStrategy,
    recordEvent: ((event: AiEngineEvent) => void) | undefined,
    providersConfig: Record<string, { readonly enabled: boolean } | undefined>
): Promise<T> {
    const rawOrder = selectProviderOrder({ feature, featureConfig });

    // Filter out providers that have an explicit config entry with enabled:false.
    // Provider ids with NO entry in the map are kept (preserves existing behaviour).
    const providerOrder = filterDisabledProviders(rawOrder, providersConfig);

    if (providerOrder.length === 0 && rawOrder.length > 0) {
        // All providers in the chain are explicitly disabled.
        throw new AiNoEnabledProviderError(feature);
    }

    if (providerOrder.length === 0) {
        // Defensive: schema requires at least a primaryProvider, but be safe.
        throw new AiEngineExhaustedError(feature, []);
    }

    const attempts: ProviderAttempt[] = [];

    for (let i = 0; i < providerOrder.length; i++) {
        const providerId = providerOrder[i] as AiProviderId;
        const provider = getProvider(providerId);

        let callCount = 0;
        let lastProviderError: Error | undefined;
        let wasRetryable = false;

        try {
            const result = await withRetry({
                fn: async () => {
                    callCount++;
                    return call(provider);
                },
                maxAttempts: MAX_ATTEMPTS_PER_PROVIDER
            });

            // Success — emit success event (only on non-primary if we fell back)
            recordEvent?.({
                type: 'success',
                feature,
                providerId
            });

            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            lastProviderError = error;
            wasRetryable = isRetryableError(error);

            attempts.push({
                providerId,
                error,
                callCount,
                wasRetryable
            });

            // Non-retryable error: do NOT fall back — surface immediately.
            if (!wasRetryable) {
                throw error;
            }

            // Retryable error after exhausting this provider's retry budget.
            // Try to fall back to the next provider if one exists.
            const nextProviderId = providerOrder[i + 1] as AiProviderId | undefined;

            if (nextProviderId !== undefined) {
                recordEvent?.({
                    type: 'fallback',
                    feature,
                    fromProvider: providerId,
                    toProvider: nextProviderId,
                    error
                });
            }
        }

        // Suppress the unused variable warning — lastProviderError is tracked
        // in `attempts` above.
        void lastProviderError;
    }

    // All providers exhausted.
    recordEvent?.({
        type: 'exhausted',
        feature,
        attempts
    });

    throw new AiEngineExhaustedError(feature, attempts);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new AI routing engine instance.
 *
 * The engine is stateless — it reads feature config on every call via
 * `resolveFeatureConfig` (which uses the in-memory cache). The only mutable
 * state lives in the config cache itself (managed by `../config/resolver.ts`).
 *
 * @param input - {@link CreateAiEngineInput}
 * @returns An {@link AiEngine} implementation.
 *
 * @example
 * ```ts
 * // T-043 wiring (apps/api):
 * const engine = createAiEngine({
 *   getProvider: (id) => {
 *     const key = vault.getDecryptedKey(id);
 *     return id === 'openai'
 *       ? new OpenAiAdapter({ apiKey: key })
 *       : new AnthropicAdapter({ apiKey: key });
 *   },
 *   recordEvent: (event) => usageQueue.push(event),
 * });
 *
 * // In a test:
 * const engine = createAiEngine({
 *   getProvider: () => new StubProvider(),
 * });
 * ```
 */
export function createAiEngine(input: CreateAiEngineInput): AiEngine {
    const {
        getProvider,
        recordEvent,
        selectProviderOrder = defaultProviderOrderStrategy,
        moderationProviderId = 'openai',
        checkCeiling,
        getNow
    } = input;

    /**
     * Resolves `config.providers` (the per-provider kill-switch map) using the
     * cached config.  Both `resolveConfig` and `resolveFeatureConfig` share the
     * same in-memory TTL cache so this is effectively a single DB read per
     * request even though we call both.
     */
    async function getProvidersConfig(): Promise<
        Record<string, { readonly enabled: boolean } | undefined>
    > {
        const config = await resolveConfig();
        // Cast: AiProvidersMap is z.partialRecord so values may be undefined.
        return config.providers as Record<string, { readonly enabled: boolean } | undefined>;
    }

    return {
        // -----------------------------------------------------------------------
        // generateText
        // -----------------------------------------------------------------------

        async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
            const featureConfig = await resolveFeatureConfig({ feature: req.feature });

            if (isFeatureKillSwitched(featureConfig)) {
                recordEvent?.({ type: 'kill_switch', feature: req.feature });
                throw new AiFeatureDisabledError(req.feature);
            }

            // Ceiling hook: awaited so a breach hard-stops the call (T-017, AC-8).
            // Only invoked when both checkCeiling and getNow are provided.
            // apps/api (T-043) supplies both; tests that omit them bypass the check.
            if (checkCeiling !== undefined && getNow !== undefined) {
                await checkCeiling({ feature: req.feature, now: getNow() });
            }

            // Input moderation (T-020): moderate user-supplied content once before
            // any provider is called. System prompts (our code) are NOT moderated.
            await runModerationPass({
                feature: req.feature,
                direction: 'input',
                text: buildInputModerationText(req.prompt, req.messages),
                moderationProviderId,
                getProvider,
                recordEvent
            });

            const providersConfig = await getProvidersConfig();

            const response = await routeWithFallback(
                req.feature,
                featureConfig,
                (provider) => provider.generateText(req),
                getProvider,
                selectProviderOrder,
                recordEvent,
                providersConfig
            );

            // Output moderation (T-020): moderate the generated text.
            await runModerationPass({
                feature: req.feature,
                direction: 'output',
                text: response.text,
                moderationProviderId,
                getProvider,
                recordEvent
            });

            return response;
        },

        // -----------------------------------------------------------------------
        // streamText
        // -----------------------------------------------------------------------

        async streamText(req: StreamTextRequest): Promise<StreamTextResult> {
            const featureConfig = await resolveFeatureConfig({ feature: req.feature });

            if (isFeatureKillSwitched(featureConfig)) {
                recordEvent?.({ type: 'kill_switch', feature: req.feature });
                throw new AiFeatureDisabledError(req.feature);
            }

            // Ceiling hook: awaited (T-017, AC-8).
            if (checkCeiling !== undefined && getNow !== undefined) {
                await checkCeiling({ feature: req.feature, now: getNow() });
            }

            const providersConfig = await getProvidersConfig();

            return routeWithFallback(
                req.feature,
                featureConfig,
                (provider) => provider.streamText(req),
                getProvider,
                selectProviderOrder,
                recordEvent,
                providersConfig
            );
        },

        // -----------------------------------------------------------------------
        // generateObject
        // -----------------------------------------------------------------------

        async generateObject<T>(
            req: GenerateObjectRequest,
            outputSchema: ZodType<T>
        ): Promise<{ object: T } & GenerateObjectResponseMeta> {
            const featureConfig = await resolveFeatureConfig({ feature: req.feature });

            if (isFeatureKillSwitched(featureConfig)) {
                recordEvent?.({ type: 'kill_switch', feature: req.feature });
                throw new AiFeatureDisabledError(req.feature);
            }

            // Ceiling hook: awaited (T-017, AC-8).
            if (checkCeiling !== undefined && getNow !== undefined) {
                await checkCeiling({ feature: req.feature, now: getNow() });
            }

            // Input moderation (T-020): generateObject has a single `prompt` field.
            await runModerationPass({
                feature: req.feature,
                direction: 'input',
                text: req.prompt,
                moderationProviderId,
                getProvider,
                recordEvent
            });

            const providersConfig = await getProvidersConfig();

            const response = await routeWithFallback(
                req.feature,
                featureConfig,
                (provider) => provider.generateObject(req, outputSchema),
                getProvider,
                selectProviderOrder,
                recordEvent,
                providersConfig
            );

            // Output moderation (T-020): JSON-stringify the object so the moderation
            // provider can evaluate any user-facing text it contains.
            await runModerationPass({
                feature: req.feature,
                direction: 'output',
                text: JSON.stringify(response.object),
                moderationProviderId,
                getProvider,
                recordEvent
            });

            return response;
        },

        // -----------------------------------------------------------------------
        // extractIntent
        // -----------------------------------------------------------------------

        async extractIntent(req: ExtractIntentRequest, feature: AiFeature): Promise<AiIntent> {
            const featureConfig = await resolveFeatureConfig({ feature });

            if (isFeatureKillSwitched(featureConfig)) {
                recordEvent?.({ type: 'kill_switch', feature });
                throw new AiFeatureDisabledError(feature);
            }

            // Ceiling hook: awaited (T-017, AC-8).
            if (checkCeiling !== undefined && getNow !== undefined) {
                await checkCeiling({ feature, now: getNow() });
            }

            // Input moderation (T-020): extractIntent output is an internal typed
            // intent — never served as user-facing content — so only the input is
            // moderated.
            await runModerationPass({
                feature,
                direction: 'input',
                text: req.query,
                moderationProviderId,
                getProvider,
                recordEvent
            });

            const providersConfig = await getProvidersConfig();

            return routeWithFallback(
                feature,
                featureConfig,
                (provider) => provider.extractIntent(req),
                getProvider,
                selectProviderOrder,
                recordEvent,
                providersConfig
            );
        },

        // -----------------------------------------------------------------------
        // moderate
        // -----------------------------------------------------------------------

        async moderate(req: ModerateRequest): Promise<ModerateResponse> {
            // Moderation bypasses feature-config routing — it goes directly to
            // the configured moderation provider without kill-switch or fallback.
            // See §12 flag in the module JSDoc for the rationale and open question.
            const provider = getProvider(moderationProviderId);
            return provider.moderate(req);
        }
    };
}
