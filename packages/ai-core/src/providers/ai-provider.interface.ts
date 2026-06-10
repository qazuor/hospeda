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
import type { ZodType } from 'zod';

/**
 * SDK-free interface for all AI provider adapters (SPEC-173 §5.2, R-4, AC-4).
 *
 * Every provider adapter (OpenAI, Anthropic, StubProvider, …) MUST implement
 * this interface. The engine and all capability helpers depend ONLY on this
 * interface — never on a concrete adapter or on the Vercel AI SDK types.
 *
 * **Credential injection — constructor pattern (see §12 flag below).**
 *
 * The interface itself is credential-free. Credentials (API keys) are injected
 * into the concrete adapter at CONSTRUCTION time — e.g.
 * `new OpenAiAdapter({ apiKey: '...' })`. The interface methods therefore carry
 * no credential parameter. See the `TODO` flag below for the owner consult note.
 *
 * **Decision (owner-approved 2026-06-04): constructor-time credential injection
 * (option a).** The concrete adapter instance binds a single decrypted API key
 * for the lifetime of the request; the engine constructs a fresh adapter
 * per-request from the decrypted key (`ai_provider_credentials`, §5.5). The
 * interface methods therefore stay credential-free. T-013 (OpenAI) and T-014
 * (Anthropic) adapters are built on this pattern.
 *
 * **Embed (V2 stub)**: the `embed` method is declared here for interface
 * completeness (it will be needed by the vector-search child spec). All V1
 * concrete implementations MUST throw `NotImplementedError`. Do NOT implement it
 * in V1 adapters.
 *
 * @module ai-core/providers
 */

// ---------------------------------------------------------------------------
// streamText return type
// ---------------------------------------------------------------------------

/**
 * The structured result of a `streamText` call.
 *
 * `stream` is an `AsyncIterable` of delta chunks — consumers `for await` over
 * it to build the streamed response incrementally.
 *
 * `meta` resolves after the stream is fully consumed and contains aggregate
 * usage stats, the resolved provider/model, and the finish reason.
 *
 * **Design rationale**: returning `{ stream, meta }` instead of an async
 * iterable-with-final-frame keeps the chunk type clean (`StreamTextChunk` is
 * only a delta), avoids union types in the stream body, and lets the SSE route
 * layer (T-024) await `meta` naturally after draining the stream.
 *
 * @example
 * ```ts
 * const { stream, meta } = await provider.streamText(request);
 * for await (const chunk of stream) {
 *   writeSse(chunk.delta);
 * }
 * const { usage, finishReason } = await meta;
 * ```
 */
export interface StreamTextResult {
    /** Delta chunks to consume incrementally. */
    readonly stream: AsyncIterable<StreamTextChunk>;
    /**
     * Resolves with aggregate metadata once the stream is fully consumed.
     * Callers MUST drain `stream` before this resolves in most adapters.
     */
    readonly meta: Promise<StreamTextFinalMeta>;
}

// ---------------------------------------------------------------------------
// embed (V2 stub types)
// ---------------------------------------------------------------------------

/**
 * Input object for the `embed` capability (V2, out-of-scope for V1).
 *
 * Defined here so the interface signature compiles without any V1 adapters
 * providing a real implementation.
 */
export interface EmbedInput {
    /** The text string to convert into a vector embedding. */
    readonly text: string;
    /**
     * Optional model identifier override.
     * When absent the adapter uses its configured default embedding model.
     */
    readonly model?: string;
}

/**
 * Output object for the `embed` capability (V2, out-of-scope for V1).
 */
export interface EmbedOutput {
    /** The dense embedding vector produced by the model. */
    readonly embedding: readonly number[];
    /** The model identifier used to produce the embedding. */
    readonly model: string;
    /** Token usage for the embedding call. */
    readonly tokens: number;
}

// ---------------------------------------------------------------------------
// AiProvider interface
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic interface for AI capabilities (SPEC-173 §5.2).
 *
 * Adapters wrap vendor SDKs behind this contract so the engine layer never
 * imports from `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, or any other
 * vendor SDK directly (R-4, AC-4).
 *
 * All methods follow the RO-RO pattern: they receive a typed input object and
 * return a typed output object (or `AsyncIterable` for streaming).
 *
 * **Credentials**: injected into the adapter constructor. See the `TODO` flag
 * at the top of this file for the owner-consult note on this design choice.
 *
 * **Identity**: the `id` property identifies which provider this adapter
 * wraps. The engine uses it for fallback resolution, usage metering, and
 * circuit-breaking.
 *
 * @example
 * ```ts
 * const provider: AiProvider = new OpenAiAdapter({ apiKey: env.OPENAI_KEY });
 * const result = await provider.generateText({ feature: 'text_improve', ... });
 * ```
 */
export interface AiProvider {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    /**
     * Stable identifier for this provider instance.
     *
     * Must be one of the values defined in `AiProviderIdSchema`.
     * The engine reads this to route usage records and circuit-break per
     * provider.
     */
    readonly id: AiProviderId;

    // -------------------------------------------------------------------------
    // Text generation (buffered)
    // -------------------------------------------------------------------------

    /**
     * Generates text from a prompt or message history (buffered, non-streaming).
     *
     * The engine uses this for single-shot capabilities such as `text_improve`
     * and `support` where the full response is required before returning to the
     * caller.
     *
     * @param input - Request envelope containing the prompt or messages, feature
     *   routing key, locale, and optional model/param overrides.
     * @returns A promise resolving to the generated text plus usage metadata.
     *
     * @example
     * ```ts
     * const resp = await provider.generateText({
     *   feature: 'text_improve',
     *   locale: 'es',
     *   prompt: 'Mejorar: "texto muy malo"',
     * });
     * console.log(resp.text);
     * ```
     */
    generateText(input: GenerateTextRequest): Promise<GenerateTextResponse>;

    // -------------------------------------------------------------------------
    // Text generation (streaming)
    // -------------------------------------------------------------------------

    /**
     * Generates text as a stream of incremental delta chunks.
     *
     * Returns a `StreamTextResult` containing:
     * - `stream`: an `AsyncIterable<StreamTextChunk>` of delta tokens.
     * - `meta`: a `Promise<StreamTextFinalMeta>` that resolves after the stream
     *   is fully consumed (usage stats, finish reason, resolved model).
     *
     * The SSE route layer (T-024) consumes `stream` and emits each delta as a
     * server-sent event, then sends `meta` as a final `[DONE]` frame.
     *
     * @param input - Same contract as `generateText` — prompt or messages,
     *   feature key, locale, optional overrides.
     * @returns A `StreamTextResult` with stream and meta handles.
     *
     * @example
     * ```ts
     * const { stream, meta } = await provider.streamText({ feature: 'chat', ... });
     * for await (const chunk of stream) {
     *   res.write(`data: ${chunk.delta}\n\n`);
     * }
     * const { usage } = await meta;
     * ```
     */
    streamText(input: StreamTextRequest): Promise<StreamTextResult>;

    // -------------------------------------------------------------------------
    // Structured object generation
    // -------------------------------------------------------------------------

    /**
     * Generates a structured object conforming to a caller-supplied Zod schema.
     *
     * The `outputSchema` is the target shape the model must produce. The engine
     * passes it through to the adapter so provider-specific structured-output
     * mechanisms (OpenAI function calling / JSON mode, Anthropic tool use) can
     * use it natively.
     *
     * The return type merges the typed `object: T` with the invariant meta
     * fields (`usage`, `provider`, `model`, `finishReason`) from
     * `GenerateObjectResponseMeta`. Callers compose the full response type:
     * ```ts
     * type MyResult = { object: MyOutput } & GenerateObjectResponseMeta;
     * ```
     *
     * @param input - Request envelope (prompt, feature, locale, optional
     *   model/param overrides). Does NOT include `messages` — structured output
     *   is one-shot in V1.
     * @param outputSchema - Zod schema describing the object the model should
     *   produce. The adapter uses this for tool definitions / JSON mode.
     * @returns The generated typed object merged with usage metadata.
     *
     * @example
     * ```ts
     * const DestinationSchema = z.object({ name: z.string(), type: z.string() });
     * const result = await provider.generateObject(
     *   { feature: 'search', locale: 'es', prompt: 'Hoteles en Colón' },
     *   DestinationSchema
     * );
     * console.log(result.object.name); // fully typed
     * ```
     */
    generateObject<T>(
        input: GenerateObjectRequest,
        outputSchema: ZodType<T>
    ): Promise<{ object: T } & GenerateObjectResponseMeta>;

    // -------------------------------------------------------------------------
    // Intent extraction
    // -------------------------------------------------------------------------

    /**
     * Extracts a structured intent from a natural-language query.
     *
     * An internal engine primitive called by the `search` and `chat` features.
     * The returned `AiIntent` is the generic base envelope; the engine or child
     * spec validates `.entities` against a domain-specific schema after receipt.
     *
     * @param input - Request envelope containing the raw query and optional
     *   locale hint.
     * @returns The extracted intent with confidence, kind, entities, and raw
     *   query preserved.
     *
     * @example
     * ```ts
     * const intent = await provider.extractIntent({
     *   query: 'cabaña con pileta para 4 personas cerca de Gualeguaychú',
     *   locale: 'es',
     * });
     * console.log(intent.kind, intent.confidence);
     * ```
     */
    extractIntent(input: ExtractIntentRequest): Promise<AiIntent>;

    // -------------------------------------------------------------------------
    // Content moderation
    // -------------------------------------------------------------------------

    /**
     * Evaluates a text input for policy violations.
     *
     * The returned `ModerateResponse` is normalised by the adapter to the
     * platform-agnostic shape — callers never see provider-specific category
     * names or score formats.
     *
     * @param input - Request containing the text to moderate and an optional
     *   locale hint.
     * @returns The moderation result: a top-level `flagged` boolean, per-category
     *   flags, and optional confidence scores.
     *
     * @example
     * ```ts
     * const result = await provider.moderate({ input: userContent });
     * if (result.flagged) {
     *   throw new ValidationError('Content policy violation');
     * }
     * ```
     */
    moderate(input: ModerateRequest): Promise<ModerateResponse>;

    // -------------------------------------------------------------------------
    // Embeddings (V2 stub — not implemented in V1)
    // -------------------------------------------------------------------------

    /**
     * Converts a text string into a dense vector embedding.
     *
     * **V2 STUB — NOT IMPLEMENTED IN V1.**
     *
     * This method is declared here so the interface is forward-compatible with
     * the vector-search child spec. All V1 concrete adapters MUST throw
     * `NotImplementedError` from this method rather than providing a real
     * implementation.
     *
     * @param input - The text to embed and an optional model override.
     * @returns A promise that V1 adapters reject with `NotImplementedError`.
     *
     * @throws {NotImplementedError} Always, in V1 adapters.
     *
     * @example
     * ```ts
     * // V2 usage (future):
     * const { embedding } = await provider.embed({ text: 'alojamiento familiar' });
     * ```
     */
    embed(input: EmbedInput): Promise<EmbedOutput>;
}

// ---------------------------------------------------------------------------
// NotImplementedError — for V2 stubs
// ---------------------------------------------------------------------------

/**
 * Error thrown by V1 adapter methods that are declared on `AiProvider` but
 * deferred to V2 (currently: `embed`).
 *
 * Using a dedicated class (instead of a plain `Error`) lets the engine and
 * tests distinguish a missing implementation from a real runtime error.
 */
export class NotImplementedError extends Error {
    /**
     * @param methodName - The name of the unimplemented method, included in the
     *   error message for clarity.
     */
    constructor(methodName: string) {
        super(`${methodName} is not implemented in V1 — deferred to V2 (SPEC-173).`);
        this.name = 'NotImplementedError';
    }
}
