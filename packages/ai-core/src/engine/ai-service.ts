/**
 * AiService — public facade for the @repo/ai-core package (SPEC-173 T-015).
 *
 * ## Responsibilities
 *
 * `AiService` is the stable, documented entry point that consuming apps (`apps/api`)
 * use to call AI capabilities. It adds value on top of the raw engine:
 *
 * 1. **Locale default** (§5.12, FR-13): every capability accepts `locale` as
 *    optional. When absent the service fills in `defaultLocale` (default: `'es'`,
 *    the Argentina market default).
 * 2. **Stable named surface**: callers never import `createAiEngine` directly —
 *    they import `createAiService` and use the typed `AiService` interface. The
 *    internal engine wiring is an implementation detail.
 * 3. **Capability composition**: each method delegates to its matching capability
 *    helper (`executeGenerateText`, `executeGenerateObject`, etc.) which perform
 *    locale-defaulting and then call the engine.
 *
 * ## What AiService does NOT do
 *
 * - Usage metering (T-016)
 * - Safety / guardrail hooks (T-018)
 * - SSE streaming wiring (T-024 — `streamText` is explicitly excluded from V1)
 * - DB or vault access — that wiring lives in `apps/api` (T-019)
 *
 * ## Relationship to AiEngine
 *
 * ```
 * AiService   ←  public API consumed by apps/api
 *     ↓ composes
 * capability helpers  ←  locale defaulting + request shaping
 *     ↓ delegates to
 * AiEngine    ←  routing, fallback, kill-switch, retry
 *     ↓ calls
 * AiProvider adapters  ←  OpenAI / Anthropic / Stub
 * ```
 *
 * ## §12 Design flag
 *
 * **streamText**: `AiService` does NOT expose `streamText` in V1. The SSE HTTP
 * wiring (T-024) needs the raw `StreamTextResult` (`{ stream, meta }`) which is
 * an internal type not suitable for the generic service surface. T-024 will wire
 * `engine.streamText` directly at the Hono route layer. This keeps the service
 * surface clean and avoids leaking the streaming plumbing into the facade.
 * If needed in V2, `streamText` can be added here with a
 * `(request: StreamTextCapabilityInput) => Promise<StreamTextResult>` signature.
 *
 * **embed (V2 stub)**: `AiService.embed` is exposed so callers already have a
 * stable import path. V1 providers throw `NotImplementedError`. The vector-search
 * child spec will replace the stub with a real implementation.
 *
 * AC-4: this file MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/engine/ai-service
 */

import type {
    AiFeature,
    AiIntent,
    AiProviderId,
    GenerateObjectResponseMeta,
    GenerateTextResponse,
    LanguageEnum,
    ModerateResponse
} from '@repo/schemas';
import type { ZodType } from 'zod';
import { executeEmbed } from '../capabilities/embed.capability.js';
import type { EmbedInput, EmbedOutput } from '../capabilities/embed.capability.js';
import { executeExtractIntent } from '../capabilities/extract-intent.capability.js';
import type { ExtractIntentCapabilityInput } from '../capabilities/extract-intent.capability.js';
import { executeGenerateObject } from '../capabilities/generate-object.capability.js';
import type { GenerateObjectCapabilityInput } from '../capabilities/generate-object.capability.js';
import { executeGenerateText } from '../capabilities/generate-text.capability.js';
import type { GenerateTextCapabilityInput } from '../capabilities/generate-text.capability.js';
import { executeModerate } from '../capabilities/moderate.capability.js';
import type { ModerateCapabilityInput } from '../capabilities/moderate.capability.js';
import { createAiEngine } from './engine.js';
import type { AiEngine, AiEngineEvent, CreateAiEngineInput } from './engine.js';

// ---------------------------------------------------------------------------
// Factory input
// ---------------------------------------------------------------------------

/**
 * Input for {@link createAiService}.
 */
export interface CreateAiServiceInput {
    /**
     * Factory function that returns a pre-constructed `AiProvider` for the
     * given `AiProviderId`.
     *
     * Forwarded directly to `createAiEngine`. The factory is called at
     * request routing time; `apps/api` (T-019) constructs concrete adapters
     * with decrypted API keys from the vault and passes them here. The service
     * itself never imports `@repo/db`, never reads env vars, and never touches
     * API keys.
     *
     * @param providerId - Which provider to return.
     * @returns A ready-to-call `AiProvider` instance.
     */
    readonly getProvider: (
        providerId: AiProviderId
    ) => import('../providers/ai-provider.interface.js').AiProvider;

    /**
     * Optional event sink for routing decisions (fallbacks, exhaustion,
     * kill-switch activations, success).
     *
     * Forwarded to `createAiEngine`. See `CreateAiEngineInput.recordEvent` for
     * the full contract.
     */
    readonly recordEvent?: (event: AiEngineEvent) => void;

    /**
     * Default locale applied to all capability calls when the caller omits
     * the `locale` field.
     *
     * Defaults to `'es'` (Argentina market default, §5.12 FR-13).
     * Must be one of `'es'`, `'en'`, or `'pt'` (`LanguageEnumSchema` values).
     */
    readonly defaultLocale?: LanguageEnum;

    /**
     * Optional provider-order strategy override (V2 seam).
     *
     * Forwarded to `createAiEngine`. Defaults to the config-order strategy.
     */
    readonly selectProviderOrder?: CreateAiEngineInput['selectProviderOrder'];

    /**
     * Optional explicit provider ID for moderation calls.
     *
     * Forwarded to `createAiEngine`. Defaults to `'openai'`.
     */
    readonly moderationProviderId?: AiProviderId;

    /**
     * Optional cost-ceiling check hook, wired by `apps/api` (T-043 / T-019).
     *
     * Forwarded directly to `createAiEngine`. When provided, the engine awaits
     * this hook BEFORE invoking any provider on each capability call. If the hook
     * throws (typically `AiCeilingHitError`) the error propagates to the caller
     * without retrying or falling back.
     *
     * When absent (the default for all existing tests), the ceiling check is
     * simply skipped — no existing tests are affected.
     *
     * See `CreateAiEngineInput.checkCeiling` for the full contract.
     *
     * Decision (owner-approved 2026-06-05): forwarded here so `apps/api` can wire
     * `checkCostCeiling` (from `@repo/ai-core`) + `createAiCostThresholdAlertHook`
     * (from `apps/api`) into a single configured service at startup.
     */
    readonly checkCeiling?: CreateAiEngineInput['checkCeiling'];

    /**
     * Optional clock factory, wired by `apps/api` (T-043 / T-019).
     *
     * Forwarded directly to `createAiEngine`. Paired with `checkCeiling` — the
     * engine calls `getNow()` once per capability call to supply the current
     * instant to `checkCeiling`. When either field is absent the ceiling check
     * is skipped for that call.
     *
     * See `CreateAiEngineInput.getNow` for the full contract.
     *
     * Decision (owner-approved 2026-06-05): wired alongside `checkCeiling` so
     * `apps/api` owns the `() => new Date()` clock and the engine stays
     * deterministic / testable without a global clock.
     */
    readonly getNow?: CreateAiEngineInput['getNow'];
}

// ---------------------------------------------------------------------------
// Public service interface
// ---------------------------------------------------------------------------

/**
 * The public AI capabilities facade for the Hospeda platform.
 *
 * Exposes locale-aware wrappers around `AiEngine` capabilities. All `locale`
 * fields are optional; when omitted the service fills in `defaultLocale`
 * (default `'es'`).
 *
 * **Do not** use the underlying engine directly from `apps/api` — always go
 * through this interface.
 *
 * Instances are created via {@link createAiService}.
 */
export interface AiService {
    /**
     * The underlying engine instance.
     *
     * Exposed for T-019 (wiring) and T-024 (SSE streaming) which need to call
     * `engine.streamText` directly at the route layer. External callers should
     * prefer the named capability methods above this.
     */
    readonly engine: AiEngine;

    /**
     * Generates text from a prompt or message history (buffered).
     *
     * `locale` defaults to `defaultLocale` (default `'es'`) when omitted.
     *
     * @param request - Generate-text request; `locale` is optional.
     * @returns The generated text plus usage metadata.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     */
    generateText(request: GenerateTextCapabilityInput): Promise<GenerateTextResponse>;

    /**
     * Generates a structured object conforming to a caller-supplied Zod schema.
     *
     * `locale` defaults to `defaultLocale` (default `'es'`) when omitted.
     *
     * @param request - Generate-object request; `locale` is optional.
     * @param outputSchema - Zod schema for the structured output type `T`.
     * @returns The generated typed object merged with usage metadata.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     */
    generateObject<T>(
        request: GenerateObjectCapabilityInput,
        outputSchema: ZodType<T>
    ): Promise<{ object: T } & GenerateObjectResponseMeta>;

    /**
     * Extracts a structured intent from a natural-language query.
     *
     * `locale` defaults to `defaultLocale` (default `'es'`) when omitted.
     * The `feature` field is required and determines the engine routing chain
     * (e.g. `'search'` or `'chat'`).
     *
     * @param request - ExtractIntent request with required `feature`; `locale` optional.
     * @returns The extracted intent envelope.
     * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
     * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
     * @throws {AiEngineExhaustedError} If all providers fail.
     */
    extractIntent(request: ExtractIntentCapabilityInput): Promise<AiIntent>;

    /**
     * Evaluates text for content policy violations.
     *
     * `locale` defaults to `defaultLocale` (default `'es'`) when omitted.
     * Moderation bypasses feature-config routing — it goes directly to the
     * configured moderation provider (default `'openai'`).
     *
     * @param request - Moderate request; `locale` is optional.
     * @returns The moderation result.
     * @throws If the moderation provider call fails.
     */
    moderate(request: ModerateCapabilityInput): Promise<ModerateResponse>;

    /**
     * Converts text to a dense vector embedding.
     *
     * **V2 STUB** — always throws `NotImplementedError` in V1. Exposed so
     * consumers already have a stable import path today. The vector-search child
     * spec will replace this with a real implementation.
     *
     * @param request - Embed request.
     * @throws {NotImplementedError} Always in V1.
     */
    embed(request: EmbedInput): Promise<EmbedOutput>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new `AiService` instance.
 *
 * Internally constructs an `AiEngine` via `createAiEngine` and wraps each
 * capability method with locale-defaulting logic.
 *
 * @param input - {@link CreateAiServiceInput}
 * @returns An {@link AiService} implementation.
 *
 * @example
 * ```ts
 * // In apps/api (T-019):
 * const service = createAiService({
 *   getProvider: (id) => {
 *     const key = vault.getDecryptedKey(id);
 *     return id === 'openai'
 *       ? new OpenAiAdapter({ apiKey: key })
 *       : new AnthropicAdapter({ apiKey: key });
 *   },
 *   recordEvent: (event) => usageQueue.push(event),
 *   defaultLocale: 'es',
 * });
 *
 * const result = await service.generateText({
 *   feature: 'text_improve',
 *   prompt: 'Fix grammar',
 *   // locale omitted → filled with 'es'
 * });
 *
 * // In tests:
 * const service = createAiService({
 *   getProvider: () => new StubProvider(),
 * });
 * ```
 */
export function createAiService(input: CreateAiServiceInput): AiService {
    const {
        getProvider,
        recordEvent,
        defaultLocale = 'es',
        selectProviderOrder,
        moderationProviderId,
        checkCeiling,
        getNow
    } = input;

    const engine: AiEngine = createAiEngine({
        getProvider,
        recordEvent,
        selectProviderOrder,
        moderationProviderId,
        checkCeiling,
        getNow
    });

    return {
        // Expose the underlying engine for T-019/T-024 direct access.
        engine,

        // -----------------------------------------------------------------------
        // generateText
        // -----------------------------------------------------------------------

        generateText(request: GenerateTextCapabilityInput): Promise<GenerateTextResponse> {
            return executeGenerateText({ request, defaultLocale, engine });
        },

        // -----------------------------------------------------------------------
        // generateObject
        // -----------------------------------------------------------------------

        generateObject<T>(
            request: GenerateObjectCapabilityInput,
            outputSchema: ZodType<T>
        ): Promise<{ object: T } & GenerateObjectResponseMeta> {
            return executeGenerateObject({ request, outputSchema, defaultLocale, engine });
        },

        // -----------------------------------------------------------------------
        // extractIntent
        // -----------------------------------------------------------------------

        extractIntent(request: ExtractIntentCapabilityInput): Promise<AiIntent> {
            return executeExtractIntent({ request, defaultLocale, engine });
        },

        // -----------------------------------------------------------------------
        // moderate
        // -----------------------------------------------------------------------

        moderate(request: ModerateCapabilityInput): Promise<ModerateResponse> {
            return executeModerate({ request, defaultLocale, engine });
        },

        // -----------------------------------------------------------------------
        // embed (V2 stub)
        // -----------------------------------------------------------------------

        embed(request: EmbedInput): Promise<EmbedOutput> {
            // V1: pass the moderation/primary provider as the embed provider.
            // All V1 adapters throw NotImplementedError from their embed method.
            const provider = getProvider(moderationProviderId ?? 'openai') as {
                readonly id: AiProviderId;
                embed(r: EmbedInput): Promise<EmbedOutput>;
            };
            return executeEmbed({ request, provider });
        }
    };
}

// ---------------------------------------------------------------------------
// Re-export capability input types for callers' convenience
// ---------------------------------------------------------------------------

export type {
    EmbedInput,
    EmbedOutput,
    ExtractIntentCapabilityInput,
    GenerateObjectCapabilityInput,
    GenerateTextCapabilityInput,
    ModerateCapabilityInput
};

/**
 * The routing feature identifier (re-exported so callers that import from
 * `AiService` don't need a separate `@repo/schemas` import for routing).
 */
export type { AiFeature };
