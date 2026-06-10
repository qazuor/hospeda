/**
 * streamText capability module (SPEC-173 T-024).
 *
 * Thin helper that shapes a `streamText` call for the AiService layer:
 * fills in the locale default when the caller omits it, then delegates to
 * the engine.
 *
 * AC-4: this module MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/capabilities/stream-text
 */

import type { AiFeature, LanguageEnum, StreamTextRequest } from '@repo/schemas';
import type { AiEngine } from '../engine/index.js';
import type { StreamTextResult } from '../providers/ai-provider.interface.js';

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for the `streamText` capability helper.
 *
 * Extends `StreamTextRequest` but makes `locale` optional — when omitted
 * the service fills in `defaultLocale` before forwarding to the engine.
 *
 * Exactly one of `prompt` or `messages` must be provided (same constraint as
 * `StreamTextRequest`; enforced by the engine's underlying Zod schema at the
 * HTTP boundary — not re-enforced here to keep the helper thin).
 */
export type StreamTextCapabilityInput = Omit<StreamTextRequest, 'locale'> & {
    /**
     * User locale for prompt localisation.
     * When absent the `AiService` fills in `defaultLocale` (default `'es'`).
     */
    readonly locale?: LanguageEnum;
};

// ---------------------------------------------------------------------------
// Capability input for the internal implementation
// ---------------------------------------------------------------------------

/**
 * Internal input shape used by {@link executeStreamText}.
 */
export interface ExecuteStreamTextInput {
    /** The raw capability request (locale may be omitted by the caller). */
    readonly request: StreamTextCapabilityInput;
    /** Resolved default locale from `AiService` config. */
    readonly defaultLocale: LanguageEnum;
    /** The engine instance to delegate to. */
    readonly engine: AiEngine;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Executes a `streamText` call via the engine, applying locale defaulting.
 *
 * 1. If `request.locale` is absent, fills in `defaultLocale` (FR-13).
 * 2. Delegates the fully-shaped request to `engine.streamText`.
 *
 * Input and output moderation are applied by the engine before returning the
 * wrapped `StreamTextResult`. The returned `stream` is an async generator that
 * yields every chunk unchanged but runs a content-moderation pass on the
 * accumulated text once the underlying stream is exhausted. If the output is
 * flagged, the generator throws `AiModerationBlockedError` after the last
 * token so the SSE consumer can emit an error event and the client can discard
 * the shown content.
 *
 * @param input - {@link ExecuteStreamTextInput}
 * @returns A `StreamTextResult` (`{ stream, meta }`) from the engine.
 *
 * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
 * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
 * @throws {AiEngineExhaustedError} If all providers fail.
 * @throws {AiModerationBlockedError} If the input is flagged before streaming
 *   or if the accumulated output is flagged after the stream ends.
 *
 * @example
 * ```ts
 * const result = await executeStreamText({
 *   request: { feature: 'chat', prompt: 'Tell me about Concepción del Uruguay' },
 *   defaultLocale: 'es',
 *   engine,
 * });
 * for await (const chunk of result.stream) {
 *   writeSse(chunk.delta);
 * }
 * const meta = await result.meta;
 * console.log(meta.usage.totalTokens);
 * ```
 */
export async function executeStreamText(input: ExecuteStreamTextInput): Promise<StreamTextResult> {
    const { request, defaultLocale, engine } = input;

    const engineRequest: StreamTextRequest = {
        ...request,
        locale: request.locale ?? defaultLocale,
        feature: request.feature as AiFeature
    };

    return engine.streamText(engineRequest);
}
