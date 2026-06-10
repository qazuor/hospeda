/**
 * Vercel AI SDK v6 adapter for OpenAI (SPEC-173 §5.2, T-013).
 *
 * `OpenAiAdapter` wraps the OpenAI provider exposed by `@ai-sdk/openai` behind
 * the platform-agnostic `AiProvider` interface. The engine and all capability
 * helpers depend ONLY on `AiProvider` — they never import this file directly
 * (R-4, AC-4).
 *
 * **Credential injection**: the API key is supplied at CONSTRUCTION time via
 * `{ apiKey }`. The adapter instance binds a single decrypted key for the
 * lifetime of the request; the engine constructs a fresh instance per-request
 * from the decrypted credential row. Methods are credential-free by design
 * (owner-approved pattern, §12 flag in interface file).
 *
 * **Moderation (Q4)**: OpenAI is the designated moderation provider for the
 * platform. `moderate()` calls the OpenAI Moderation REST endpoint directly
 * because `@ai-sdk/openai` v3 does not expose a moderation helper. The raw
 * OpenAI Moderation API response is mapped to `ModerateResponse`.
 *
 * **Embed (V2 stub)**: `embed()` throws `NotImplementedError`. It is declared
 * here for interface compliance but deferred to the vector-search child spec.
 *
 * @module ai-core/providers
 */

import { createOpenAI } from '@ai-sdk/openai';
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
// OpenAI Moderation REST response shape (minimal, internal)
// ---------------------------------------------------------------------------

/** Internal shape of a single OpenAI moderation result entry. */
interface OpenAiModerationResult {
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
}

/** Internal shape of the OpenAI Moderation API response body. */
interface OpenAiModerationResponse {
    results: OpenAiModerationResult[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default model used when the request does not specify an override. */
const DEFAULT_MODEL = 'gpt-4o-mini' as const;

/** OpenAI Moderation API endpoint. */
const MODERATION_ENDPOINT = 'https://api.openai.com/v1/moderations' as const;

// ---------------------------------------------------------------------------
// Constructor input
// ---------------------------------------------------------------------------

/**
 * Constructor options for `OpenAiAdapter`.
 *
 * Only the API key is required. The adapter uses it to create a scoped
 * `OpenAIProvider` factory that is bound to this instance.
 */
export interface OpenAiAdapterOptions {
    /**
     * Decrypted OpenAI API key.
     * Injected at construction time; never read from `process.env` (AC-4).
     */
    readonly apiKey: string;
    /**
     * Optional base URL for OpenAI-compatible APIs (Ollama, LM Studio,
     * Together, Groq, DeepSeek, etc.). When provided, the adapter sends
     * requests to this URL instead of the default OpenAI endpoint.
     *
     * @example 'http://localhost:11434/v1'  // Ollama
     * @example 'https://api.groq.com/openai/v1'  // Groq
     */
    readonly baseURL?: string;
}

// ---------------------------------------------------------------------------
// OpenAiAdapter
// ---------------------------------------------------------------------------

/**
 * Vercel AI SDK v6 adapter for OpenAI.
 *
 * Wraps `@ai-sdk/openai`'s `createOpenAI` factory behind the `AiProvider`
 * interface. All public methods are credential-free — the key is bound at
 * construction time.
 *
 * Default model: `gpt-4o-mini`. Callers may override per-request via
 * `input.model`.
 *
 * @example
 * ```ts
 * const adapter = new OpenAiAdapter({ apiKey: env.OPENAI_API_KEY });
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
export class OpenAiAdapter implements AiProvider {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    /**
     * Stable provider identifier.
     * Always `'openai'` for this adapter.
     */
    readonly id: AiProviderId = 'openai';

    // -------------------------------------------------------------------------
    // Private state
    // -------------------------------------------------------------------------

    /** SDK provider factory scoped to the injected API key. */
    private readonly provider: ReturnType<typeof createOpenAI>;

    /** The raw API key, kept for the moderation fetch call. */
    private readonly apiKey: string;

    /**
     * `true` when the adapter was constructed with a custom `baseURL`.
     *
     * When `true`, calls route through `/v1/chat/completions` (local-compatible
     * providers like Ollama, LM Studio, Groq) via `this.provider.chat(model)`.
     * When `false`, the default `this.provider(model)` targets the Responses API
     * (`/v1/responses`), which is what real OpenAI expects.
     */
    private readonly hasCustomBaseUrl: boolean;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * Creates an `OpenAiAdapter` bound to the supplied API key.
     *
     * The key is injected once and used for the lifetime of this instance.
     * The engine constructs a fresh adapter per-request from the decrypted
     * credential row — never share instances across requests with different keys.
     *
     * @param options - Construction options containing the API key and optional baseURL.
     */
    constructor({ apiKey, baseURL }: OpenAiAdapterOptions) {
        this.apiKey = apiKey;
        this.hasCustomBaseUrl = baseURL !== undefined;
        this.provider = createOpenAI({ apiKey, ...(baseURL !== undefined ? { baseURL } : {}) });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves the language model instance for a given model ID.
     *
     * When a custom `baseURL` was provided at construction time the provider is
     * a local OpenAI-compatible server (Ollama, LM Studio, etc.) that implements
     * `/v1/chat/completions` but NOT the Responses API (`/v1/responses`).
     * In that case we MUST use `this.provider.chat(model)` so requests are routed
     * to `/v1/chat/completions`. For real OpenAI (no baseURL) the default callable
     * `this.provider(model)` targets the Responses API, which is correct.
     *
     * @param modelId - Resolved model identifier string.
     * @returns SDK LanguageModel bound to the correct endpoint.
     */
    private resolveLanguageModel(modelId: string): ReturnType<ReturnType<typeof createOpenAI>> {
        // When a custom baseURL is set (local/compatible provider), force chat-completions
        // endpoint via provider.chat(). Real OpenAI uses provider(model) → Responses API.
        if (this.hasCustomBaseUrl) {
            return this.provider.chat(modelId);
        }
        return this.provider(modelId);
    }

    // -------------------------------------------------------------------------
    // generateText
    // -------------------------------------------------------------------------

    /**
     * Generates text using the OpenAI language model (buffered, non-streaming).
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
        const languageModel = this.resolveLanguageModel(model);

        const baseParams = {
            model: languageModel,
            temperature: input.params?.temperature,
            maxOutputTokens: input.params?.maxTokens,
            topP: input.params?.topP,
            // Disable SDK-level retries so the engine's withRetry is the sole
            // retry authority. Without this the SDK defaults to maxRetries:2 (3
            // attempts) stacked on top of the engine's MAX_ATTEMPTS_PER_PROVIDER=2,
            // yielding up to 6 provider calls per request.
            maxRetries: 0 as const
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
        const languageModel = this.resolveLanguageModel(model);

        const baseParams = {
            model: languageModel,
            temperature: input.params?.temperature,
            maxOutputTokens: input.params?.maxTokens,
            topP: input.params?.topP,
            // Disable SDK-level retries — engine's withRetry is the sole authority.
            // See generateText for the full rationale (6-call stacking prevention).
            maxRetries: 0 as const
        };

        // streamText() returns synchronously (not a promise). Branch into two
        // distinct SDK calls to avoid the spread-union type issue (same as in
        // generateText — the SDK overload won't accept a union shape).
        const sdkResult =
            input.prompt !== undefined
                ? streamText({ ...baseParams, prompt: input.prompt })
                : streamText({ ...baseParams, messages: input.messages ?? [] });

        // Wrap the SDK's AsyncIterableStream<string> in our chunk shape.
        const sdkTextStream = sdkResult.textStream;
        async function* makeStream(): AsyncGenerator<StreamTextChunk> {
            for await (const delta of sdkTextStream) {
                yield { delta };
            }
        }

        // meta resolves after both usage and finishReason are available.
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
     * so that the provider's structured-output mechanism (JSON mode / function
     * calling) is used natively.
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
        const languageModel = this.resolveLanguageModel(model);

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
            topP: input.params?.topP,
            // Disable SDK-level retries — engine's withRetry is the sole authority.
            // Without maxRetries:0 the SDK defaults to 2 retries (3 total attempts),
            // which stacks on top of the engine's MAX_ATTEMPTS_PER_PROVIDER=2 and
            // produces up to 6 provider calls per request.
            maxRetries: 0
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
     * Extracts a structured intent from a natural-language query using OpenAI.
     *
     * Delegates to `generateObject` with the platform's `AiIntentSchema` as the
     * output schema. The prompt instructs the model to produce the base intent
     * shape (kind, confidence, entities, rawQuery).
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
    // moderate
    // -------------------------------------------------------------------------

    /**
     * Evaluates text for policy violations using the OpenAI Moderation API.
     *
     * The Vercel AI SDK v6 does not expose a moderation helper, so this method
     * calls the OpenAI Moderation REST endpoint directly using `fetch` with the
     * injected API key.
     *
     * The raw OpenAI response is mapped to the platform-agnostic
     * `ModerateResponse` shape: top-level `flagged`, per-category `categories`,
     * and per-category `scores`.
     *
     * @param input - Request containing the text to moderate and an optional
     *   locale hint (ignored by OpenAI — moderation is language-agnostic).
     * @returns The normalised moderation result.
     *
     * @throws {Error} If the OpenAI API returns a non-OK HTTP status.
     */
    async moderate(input: ModerateRequest): Promise<ModerateResponse> {
        const response = await fetch(MODERATION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ input: input.input })
        });

        if (!response.ok) {
            throw new Error(
                `OpenAI Moderation API error: ${response.status} ${response.statusText}`
            );
        }

        const data = (await response.json()) as OpenAiModerationResponse;
        const result = data.results[0];

        if (result === undefined) {
            // OpenAI always returns at least one result for a non-empty input;
            // guard against unexpected empty responses.
            return { flagged: false, categories: {} };
        }

        return {
            flagged: result.flagged,
            categories: result.categories,
            scores: result.category_scores
        };
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
