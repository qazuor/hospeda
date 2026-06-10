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
import type {
    AiProvider,
    EmbedInput,
    EmbedOutput,
    StreamTextResult
} from './ai-provider.interface.js';
import { NotImplementedError } from './ai-provider.interface.js';

/**
 * Deterministic stub provider for the Hospeda AI core (SPEC-173 §5.14, R-6).
 *
 * `StubProvider` implements `AiProvider` without making any network calls, SDK
 * calls, or environment reads. Every response is derived deterministically from
 * the input — same input always produces the same output.
 *
 * **Intended uses**:
 * - Unit and integration tests across the entire `@repo/ai-core` package.
 * - Local development when no real provider key is configured.
 * - CI pipelines that must not make external calls.
 *
 * **Determinism contract**:
 * - `generateText`: echoes the prompt/last-message as `[stub:${feature}] ${text}`.
 * - `streamText`: emits three fixed delta chunks derived from the same echo
 *   formula, then resolves `meta` with fixed token counts.
 * - `generateObject`: calls the adapter's internal text echo, then parses it
 *   against the provided Zod schema using `safeParse`. If the schema cannot
 *   parse the raw string, the schema's `.parse({})` fallback is attempted;
 *   the adapter uses `schema.parse({})` as the typed object so that tests can
 *   always supply a schema whose empty-object shape parses successfully.
 *   In practice, tests supply a schema whose `safeParse` on the echo string
 *   will fail — the stub then falls back to `schema.parse({})`. This keeps the
 *   contract: same input schema → same output object.
 * - `extractIntent`: returns a fixed intent with `kind: 'stub'`, confidence
 *   `0.99`, empty entities, and the original query as `rawQuery`.
 * - `moderate`: always returns `{ flagged: false, categories: {} }`.
 * - `embed`: throws `NotImplementedError` (V2 stub, see interface).
 *
 * **Credential injection**: `StubProvider` requires no API key. It can be
 * constructed with no arguments (or optionally with an explicit override id for
 * introspection tests, though `'stub'` is always the correct value).
 *
 * @example
 * ```ts
 * const provider = new StubProvider();
 * const result = await provider.generateText({
 *   feature: 'text_improve',
 *   locale: 'es',
 *   prompt: 'hola',
 * });
 * // result.text === '[stub:text_improve] hola'
 * ```
 *
 * @module ai-core/providers
 */
export class StubProvider implements AiProvider {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    /**
     * The stable provider identifier for the stub.
     * Always `'stub'` — never overrideable to keep tests deterministic.
     */
    readonly id: AiProviderId = 'stub';

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Derives the deterministic text echo from a `generateText`-style request.
     *
     * - If `prompt` is supplied, echoes `[stub:${feature}] ${prompt}`.
     * - If `messages` is supplied, uses the content of the last message.
     *
     * The `feature` comes from `input.feature` (always present on capability
     * requests). For requests that lack a `feature` field (e.g. `moderate`,
     * `extractIntent`), callers use a literal feature tag directly.
     *
     * @param feature - The feature tag to embed in the echo (e.g. `'text_improve'`).
     * @param prompt - Optional plain-text prompt.
     * @param messages - Optional message array (last message's content is used).
     * @returns Deterministic echo string.
     */
    private static buildEcho(
        feature: string,
        prompt: string | undefined,
        messages: ReadonlyArray<{ readonly content: string }> | undefined
    ): string {
        const text =
            prompt ??
            (messages !== undefined && messages.length > 0
                ? (messages[messages.length - 1]?.content ?? '')
                : '');
        return `[stub:${feature}] ${text}`;
    }

    /** Fixed usage stats returned by all stub methods. */
    private static readonly STUB_USAGE = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
    } as const;

    /** Fixed finish reason for all stub responses. */
    private static readonly FINISH_REASON = 'stop' as const;

    /** Fixed model identifier reported by the stub. */
    private static readonly MODEL = 'stub-model-v1' as const;

    // -------------------------------------------------------------------------
    // generateText
    // -------------------------------------------------------------------------

    /**
     * Returns a deterministic `GenerateTextResponse`.
     *
     * `text` is `[stub:${feature}] ${prompt_or_last_message}`.
     * `usage` is fixed at 10/20/30 tokens. `provider` is `'stub'`.
     * `model` is `'stub-model-v1'`. `finishReason` is `'stop'`.
     *
     * @param input - The generate-text request envelope.
     * @returns Deterministic text response.
     */
    generateText(input: GenerateTextRequest): Promise<GenerateTextResponse> {
        const text = StubProvider.buildEcho(input.feature, input.prompt, input.messages);
        return Promise.resolve({
            text,
            usage: { ...StubProvider.STUB_USAGE },
            provider: this.id,
            model: StubProvider.MODEL,
            finishReason: StubProvider.FINISH_REASON
        });
    }

    // -------------------------------------------------------------------------
    // streamText
    // -------------------------------------------------------------------------

    /**
     * Returns a `StreamTextResult` whose `stream` yields three deterministic
     * chunks and whose `meta` resolves with the same fixed metadata as
     * `generateText`.
     *
     * The three chunks split the echo string into thirds (by character index).
     * This gives tests a predictable multi-chunk sequence to assert on.
     *
     * @param input - The stream-text request envelope.
     * @returns A `StreamTextResult` with deterministic chunks and meta.
     */
    streamText(input: StreamTextRequest): Promise<StreamTextResult> {
        const fullText = StubProvider.buildEcho(input.feature, input.prompt, input.messages);

        // Split the echo text deterministically into 3 chunks.
        const third = Math.ceil(fullText.length / 3);
        const chunks: StreamTextChunk[] = [
            { delta: fullText.slice(0, third) },
            { delta: fullText.slice(third, third * 2) },
            { delta: fullText.slice(third * 2) }
        ];

        const finalMeta: StreamTextFinalMeta = {
            usage: { ...StubProvider.STUB_USAGE },
            provider: this.id,
            model: StubProvider.MODEL,
            finishReason: StubProvider.FINISH_REASON
        };

        // Build the async iterable from the pre-computed chunk array.
        async function* makeStream(): AsyncGenerator<StreamTextChunk> {
            for (const chunk of chunks) {
                yield chunk;
            }
        }

        const stream = makeStream();
        const meta = Promise.resolve(finalMeta);

        return Promise.resolve({ stream, meta });
    }

    // -------------------------------------------------------------------------
    // generateObject
    // -------------------------------------------------------------------------

    /**
     * Returns a `{ object: T } & GenerateObjectResponseMeta` where `object` is
     * the result of parsing an empty object `{}` through `outputSchema`.
     *
     * **Stub strategy**: the echo text (derived from the prompt) is a string,
     * which will not parse as a structured object for most schemas. The stub
     * therefore always calls `outputSchema.parse({})` — the caller MUST supply
     * a schema whose empty-object input is valid (or use optional/default fields).
     * This is acceptable because the stub is only used in unit tests where the
     * schema is fully controlled.
     *
     * @param input - The generate-object request envelope.
     * @param outputSchema - Zod schema for the target type `T`.
     * @returns Deterministic `{ object: T }` merged with fixed usage metadata.
     *
     * @throws {ZodError} If `outputSchema.parse({})` fails (caller error).
     */
    generateObject<T>(
        _input: GenerateObjectRequest,
        outputSchema: ZodType<T>
    ): Promise<{ object: T } & GenerateObjectResponseMeta> {
        // Parse an empty object through the schema so the return value is typed
        // as T. Tests should use schemas with all-optional fields or defaults.
        const object = outputSchema.parse({});

        return Promise.resolve({
            object,
            usage: { ...StubProvider.STUB_USAGE },
            provider: this.id,
            model: StubProvider.MODEL,
            finishReason: StubProvider.FINISH_REASON
        });
    }

    // -------------------------------------------------------------------------
    // extractIntent
    // -------------------------------------------------------------------------

    /**
     * Returns a fixed, deterministic `AiIntent` derived from the request.
     *
     * - `kind`: always `'stub'`
     * - `confidence`: always `0.99`
     * - `entities`: always `{}` (empty — no real extraction performed)
     * - `rawQuery`: echoes the original `input.query`
     *
     * @param input - The extract-intent request envelope.
     * @returns A deterministic intent envelope.
     */
    extractIntent(input: ExtractIntentRequest): Promise<AiIntent> {
        return Promise.resolve({
            kind: 'stub',
            confidence: 0.99,
            entities: {},
            rawQuery: input.query
        });
    }

    // -------------------------------------------------------------------------
    // moderate
    // -------------------------------------------------------------------------

    /**
     * Returns a deterministic moderation result based on the input text.
     *
     * **Magic-marker convention** (consistent with `buildEcho` prefix markers
     * used by `generateText` / `streamText`):
     *
     * - If `input.input` contains the substring `[stub:flagged]`, the response
     *   is `{ flagged: true, categories: { test: true } }`. Use this marker in
     *   test inputs to exercise the moderation-blocked path without a real
     *   provider.
     * - Otherwise, the response is `{ flagged: false, categories: {} }` —
     *   the same clean result as before T-020.
     *
     * No `scores` field is included (providers that don't return scores may
     * omit it; the stub follows that pattern).
     *
     * @param input - The moderation request.
     * @returns A deterministic moderation response.
     *
     * @example
     * ```ts
     * const stub = new StubProvider();
     * const clean = await stub.moderate({ input: 'hello' });
     * // clean.flagged === false
     *
     * const flagged = await stub.moderate({ input: 'bad content [stub:flagged]' });
     * // flagged.flagged === true, flagged.categories === { test: true }
     * ```
     */
    moderate(input: ModerateRequest): Promise<ModerateResponse> {
        if (input.input.includes('[stub:flagged]')) {
            return Promise.resolve({
                flagged: true,
                categories: { test: true }
            });
        }
        return Promise.resolve({
            flagged: false,
            categories: {}
        });
    }

    // -------------------------------------------------------------------------
    // embed (V2 stub)
    // -------------------------------------------------------------------------

    /**
     * Always throws `NotImplementedError`.
     *
     * `embed` is a V2 capability. V1 tests MUST NOT call this method. The
     * interface declares it for forward-compatibility with the vector-search
     * child spec.
     *
     * @param _input - Ignored.
     * @throws {NotImplementedError} Always.
     */
    embed(_input: EmbedInput): Promise<EmbedOutput> {
        return Promise.reject(new NotImplementedError('embed'));
    }
}
