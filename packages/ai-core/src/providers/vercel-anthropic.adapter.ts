/**
 * Vercel AI SDK v6 adapter for Anthropic (SPEC-173 §5.2, T-013).
 *
 * `AnthropicAdapter` wraps the Anthropic provider exposed by `@ai-sdk/anthropic`
 * behind the platform-agnostic `AiProvider` interface. The engine and all
 * capability helpers depend ONLY on `AiProvider` — they never import this file
 * directly (R-4, AC-4).
 *
 * **Credential injection**: the API key is supplied at CONSTRUCTION time via
 * `{ apiKey }`. The adapter instance binds a single decrypted key for the
 * lifetime of the request.
 *
 * **Moderation — NOT supported (§12 flag)**:
 * Anthropic has no native moderation endpoint. Per Q4 of the spec, OpenAI is
 * the designated moderation provider for the platform. The engine's moderation
 * step (T-019) MUST always route moderation to a provider that supports it
 * (i.e. `OpenAiAdapter`), independent of the generation provider in use.
 *
 * `moderate()` on `AnthropicAdapter` therefore throws a descriptive
 * `NotImplementedError`. The engine must never call `moderate()` on an
 * `AnthropicAdapter` instance.
 *
 * TODO(SPEC-173 §12 consult owner): AnthropicAdapter.moderate() throws —
 * moderation is always routed to OpenAI per Q4. Confirm this engine-routing
 * expectation before wiring T-019.
 *
 * **Embed (V2 stub)**: `embed()` throws `NotImplementedError`. Anthropic does
 * not provide an embeddings API as of the Vercel AI SDK v6 surface; it is
 * declared here for interface compliance and deferred to the vector-search
 * child spec.
 *
 * @module ai-core/providers
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import type {
    AiIntent,
    AiProviderId,
    ExtractIntentRequest,
    GenerateObjectRequest,
    GenerateObjectResponseMeta,
    GenerateTextRequest,
    GenerateTextResponse,
    ModerateRequest,
    ModerateResponse,
    StreamTextChunk,
    StreamTextFinalMeta,
    StreamTextRequest
} from '@repo/schemas';
import { AiIntentSchema } from '@repo/schemas';
import { generateObject, generateText, streamText, zodSchema } from 'ai';
import type { ZodType } from 'zod';
import { mapFinishReason, mapSdkUsage, resolveModel } from './adapter-mappers.js';
import type {
    AiProvider,
    EmbedInput,
    EmbedOutput,
    StreamTextResult
} from './ai-provider.interface.js';
import { NotImplementedError } from './ai-provider.interface.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default model used when the request does not specify an override. */
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022' as const;

// ---------------------------------------------------------------------------
// Constructor input
// ---------------------------------------------------------------------------

/**
 * Constructor options for `AnthropicAdapter`.
 *
 * Only the API key is required. The adapter uses it to create a scoped
 * `AnthropicProvider` factory that is bound to this instance.
 */
export interface AnthropicAdapterOptions {
    /**
     * Decrypted Anthropic API key.
     * Injected at construction time; never read from `process.env` (AC-4).
     */
    readonly apiKey: string;
}

// ---------------------------------------------------------------------------
// AnthropicAdapter
// ---------------------------------------------------------------------------

/**
 * Vercel AI SDK v6 adapter for Anthropic.
 *
 * Wraps `@ai-sdk/anthropic`'s `createAnthropic` factory behind the `AiProvider`
 * interface. All public methods are credential-free — the key is bound at
 * construction time.
 *
 * Default model: `claude-3-5-haiku-20241022`. Callers may override per-request
 * via `input.model`.
 *
 * **Moderation**: this adapter does NOT support `moderate()`. The engine must
 * always route moderation to `OpenAiAdapter`. See module-level docs above.
 *
 * @example
 * ```ts
 * const adapter = new AnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY });
 * const response = await adapter.generateText({
 *   feature: 'text_improve',
 *   locale: 'es',
 *   prompt: 'Mejorar: "texto muy malo"',
 * });
 * console.log(response.text);
 * ```
 *
 * @module ai-core/providers
 */
export class AnthropicAdapter implements AiProvider {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    /**
     * Stable provider identifier.
     * Always `'anthropic'` for this adapter.
     */
    readonly id: AiProviderId = 'anthropic';

    // -------------------------------------------------------------------------
    // Private state
    // -------------------------------------------------------------------------

    /** SDK provider factory scoped to the injected API key. */
    private readonly provider: ReturnType<typeof createAnthropic>;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * Creates an `AnthropicAdapter` bound to the supplied API key.
     *
     * The key is injected once and used for the lifetime of this instance.
     * The engine constructs a fresh adapter per-request from the decrypted
     * credential row — never share instances across requests with different keys.
     *
     * @param options - Construction options containing the API key.
     */
    constructor({ apiKey }: AnthropicAdapterOptions) {
        this.provider = createAnthropic({ apiKey });
    }

    // -------------------------------------------------------------------------
    // generateText
    // -------------------------------------------------------------------------

    /**
     * Generates text using the Anthropic language model (buffered, non-streaming).
     *
     * Maps the platform-agnostic `GenerateTextRequest` to the SDK's
     * `generateText()` call, then maps the result back to `GenerateTextResponse`.
     *
     * @param input - Request envelope: `prompt` or `messages`, plus optional
     *   model/param overrides and the feature routing key.
     * @returns The generated text with usage stats, provider, model, and finish
     *   reason.
     */
    async generateText(input: GenerateTextRequest): Promise<GenerateTextResponse> {
        const model = resolveModel(input.model, DEFAULT_MODEL);
        const languageModel = this.provider(model);

        const baseParams = {
            model: languageModel,
            temperature: input.params?.temperature,
            maxOutputTokens: input.params?.maxTokens,
            topP: input.params?.topP
        };

        // Branch into two distinct SDK calls to avoid the spread-union type that
        // TypeScript infers from `{...prompt} | {...messages}` — the SDK's
        // generateText() overload does not accept a union, only a concrete shape.
        const sdkResult =
            input.prompt !== undefined
                ? await generateText({ ...baseParams, prompt: input.prompt })
                : await generateText({ ...baseParams, messages: input.messages ?? [] });

        return {
            text: sdkResult.text,
            usage: mapSdkUsage(sdkResult.usage),
            provider: this.id,
            model,
            finishReason: mapFinishReason(sdkResult.finishReason)
        };
    }

    // -------------------------------------------------------------------------
    // streamText
    // -------------------------------------------------------------------------

    /**
     * Generates text as a stream of incremental delta chunks.
     *
     * The SDK's `streamText()` is called synchronously (it returns
     * `StreamTextResult` immediately, not a promise). The adapter bridges it to
     * the interface's `StreamTextResult` shape by:
     * - Wrapping `sdkResult.textStream` (AsyncIterableStream<string>) in an
     *   async generator that yields `StreamTextChunk` objects.
     * - Constructing `meta` as a `Promise<StreamTextFinalMeta>` that resolves
     *   from `sdkResult.usage` and `sdkResult.finishReason` (both PromiseLike).
     *
     * @param input - Same contract as `generateText`.
     * @returns `{ stream, meta }` where `stream` yields delta chunks and `meta`
     *   resolves after the stream is drained.
     */
    async streamText(input: StreamTextRequest): Promise<StreamTextResult> {
        const model = resolveModel(input.model, DEFAULT_MODEL);
        const languageModel = this.provider(model);

        const baseParams = {
            model: languageModel,
            temperature: input.params?.temperature,
            maxOutputTokens: input.params?.maxTokens,
            topP: input.params?.topP
        };

        // streamText() returns synchronously (not a promise). Branch into two
        // distinct SDK calls to avoid the spread-union type issue (same as in
        // generateText — the SDK overload won't accept a union shape).
        const sdkResult =
            input.prompt !== undefined
                ? streamText({ ...baseParams, prompt: input.prompt })
                : streamText({ ...baseParams, messages: input.messages ?? [] });

        const sdkTextStream = sdkResult.textStream;
        async function* makeStream(): AsyncGenerator<StreamTextChunk> {
            for await (const delta of sdkTextStream) {
                yield { delta };
            }
        }

        const capturedId = this.id;
        const meta = Promise.all([sdkResult.usage, sdkResult.finishReason]).then(
            ([usage, finishReason]): StreamTextFinalMeta => ({
                usage: mapSdkUsage(usage),
                provider: capturedId,
                model,
                finishReason: mapFinishReason(finishReason)
            })
        );

        return { stream: makeStream(), meta };
    }

    // -------------------------------------------------------------------------
    // generateObject
    // -------------------------------------------------------------------------

    /**
     * Generates a structured object conforming to a caller-supplied Zod schema.
     *
     * Uses the SDK's `generateObject()` with `schema` set to `zodSchema(outputSchema)`
     * so that the provider's structured-output mechanism (tool use / JSON mode)
     * is used natively.
     *
     * @param input - Request envelope with prompt, feature key, and optional
     *   model/param overrides.
     * @param outputSchema - Zod schema for the target type `T`.
     * @returns The generated typed `object` merged with usage metadata.
     */
    async generateObject<T>(
        input: GenerateObjectRequest,
        outputSchema: ZodType<T>
    ): Promise<{ object: T } & GenerateObjectResponseMeta> {
        const model = resolveModel(input.model, DEFAULT_MODEL);
        const languageModel = this.provider(model);

        // Cast outputSchema to `any` before passing to zodSchema() to break
        // the cross-version Zod type-unification chain. The `ai` SDK's zodSchema()
        // expects its own bundled zod@4.4.x types; our caller passes zod@4.3.x
        // schemas (from @repo/schemas). TypeScript tries to unify the two
        // incompatible ZodType generics and recurses infinitely (TS2589/OOM).
        // The cast is safe: zodSchema() only reads the schema's _def at runtime,
        // and both zod versions produce structurally identical _def objects.
        const sdkResult = await generateObject({
            model: languageModel,
            // biome-ignore lint/suspicious/noExplicitAny: intentional cross-zod-version boundary cast
            schema: zodSchema(outputSchema as unknown as any),
            prompt: input.prompt,
            temperature: input.params?.temperature,
            maxOutputTokens: input.params?.maxTokens,
            topP: input.params?.topP
        });

        // The SDK's generateObject().object can be undefined (e.g. when the
        // model returns no valid structured output). Throw rather than silently
        // propagate undefined as the typed T to callers.
        if (sdkResult.object === undefined) {
            throw new Error(
                `generateObject returned undefined object for model "${model}". The model may have failed to produce a valid structured output.`
            );
        }

        return {
            object: sdkResult.object as T,
            usage: mapSdkUsage(sdkResult.usage),
            provider: this.id,
            model,
            finishReason: mapFinishReason(sdkResult.finishReason)
        };
    }

    // -------------------------------------------------------------------------
    // extractIntent
    // -------------------------------------------------------------------------

    /**
     * Extracts a structured intent from a natural-language query using Anthropic.
     *
     * Delegates to `generateObject` with the platform's `AiIntentSchema` as the
     * output schema.
     *
     * @param input - Request containing the raw query and an optional locale hint.
     * @returns A validated `AiIntent` with kind, confidence, entities, and rawQuery.
     */
    async extractIntent(input: ExtractIntentRequest): Promise<AiIntent> {
        const localeHint =
            input.locale !== undefined ? ` The user query is in locale: ${input.locale}.` : '';

        const prompt = `Extract the intent from the following user query.${localeHint} Return a JSON object with: kind (string describing intent type), confidence (number 0-1), entities (object with extracted slots), rawQuery (the original query unchanged). Query: "${input.query}"`;

        // Cast AiIntentSchema to `ZodType<AiIntent>` to avoid TS2589 — the
        // deep-instantiation OOM caused by two incompatible Zod versions (4.3.x
        // from @repo/schemas vs 4.4.x bundled by the `ai` SDK) trying to unify
        // when TypeScript resolves the generic `T` from the schema argument.
        // The cast is safe: AiIntentSchema IS a ZodObject that produces AiIntent
        // at runtime; we're only suppressing the structural type check.
        const result = await this.generateObject(
            {
                feature: 'search',
                locale: input.locale ?? 'es',
                prompt
            },
            AiIntentSchema as unknown as ZodType<AiIntent>
        );

        // result.object is non-undefined here: generateObject() throws if the
        // SDK returns undefined — see the guard inside generateObject().
        return result.object;
    }

    // -------------------------------------------------------------------------
    // moderate — NOT SUPPORTED
    // -------------------------------------------------------------------------

    /**
     * NOT supported by Anthropic. Always throws.
     *
     * Anthropic has no native content moderation endpoint. The platform
     * routes all moderation calls to `OpenAiAdapter` regardless of which
     * provider is used for generation (Q4, §12).
     *
     * The engine (T-019) must never call `moderate()` on an `AnthropicAdapter`
     * instance. If you reach this error it is a wiring bug in the engine.
     *
     * TODO(SPEC-173 §12 consult owner): AnthropicAdapter.moderate() throws —
     * moderation is always routed to OpenAI per Q4. Confirm this engine-routing
     * expectation before wiring T-019.
     *
     * @param _input - Ignored.
     * @throws {NotImplementedError} Always, with a descriptive message
     *   explaining that moderation must be routed to OpenAI.
     */
    moderate(_input: ModerateRequest): Promise<ModerateResponse> {
        return Promise.reject(
            new NotImplementedError(
                'AnthropicAdapter.moderate — Anthropic has no moderation endpoint. Route moderation to OpenAiAdapter (SPEC-173 Q4, §12).'
            )
        );
    }

    // -------------------------------------------------------------------------
    // embed (V2 stub)
    // -------------------------------------------------------------------------

    /**
     * Not implemented in V1.
     *
     * `embed` is a V2 capability deferred to the vector-search child spec.
     * Throws `NotImplementedError` unconditionally.
     *
     * @param _input - Ignored.
     * @throws {NotImplementedError} Always.
     */
    embed(_input: EmbedInput): Promise<EmbedOutput> {
        return Promise.reject(new NotImplementedError('embed'));
    }
}
