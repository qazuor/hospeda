/**
 * Content-moderation pass for the AI routing engine (SPEC-173 T-020, T-024).
 *
 * This module provides two public helpers:
 *
 * - {@link runModerationPass}: called by `generateText`, `generateObject`,
 *   `extractIntent`, and the input-moderation step of `streamText` to evaluate
 *   user-supplied or model-generated text against the moderation provider.
 *
 * - {@link wrapStreamWithOutputModeration}: wraps a `StreamTextResult` so that
 *   after all chunks are yielded, the accumulated text is moderated. If flagged,
 *   the generator throws `AiModerationBlockedError` after the last token.
 *
 * ## Opt-in moderation (post-SPEC-198 revision)
 *
 * Moderation is now OPT-IN. When `moderationProviderId` is `undefined` (not
 * configured by the admin), the pass returns immediately without calling any
 * provider. No error is thrown and no event is emitted — the capability call
 * continues as if the pass were clean. Moderation is only active when an admin
 * explicitly sets a moderation provider in `ai_settings.moderation.providerId`.
 *
 * ## Fail-open guarantee (with one fail-CLOSED exception — SPEC-198)
 *
 * When a provider IS configured: if the moderation provider call throws because
 * of a TRANSIENT failure (network error, timeout, rate-limit, 5xx, provider
 * down), the error is caught, a `moderation_error` event is emitted via
 * `recordEvent`, and the helper returns normally — allowing the capability call
 * to continue unmoderated. A provider hiccup MUST NOT take down AI features.
 *
 * The SOLE exception is `AiProviderUnconfiguredError`: when `getProvider` throws
 * because the configured moderation provider has NO resolvable credential, the
 * helper RE-THROWS it (fail-CLOSED). A configured-but-uncredentialed provider
 * is a server misconfiguration — if the admin explicitly configured a provider
 * and its credential is missing, we block rather than silently proceed.
 * `AiModerationBlockedError` is also always re-thrown (deliberate content block,
 * never swallowed).
 *
 * ## Skip conditions
 *
 * - `moderationProviderId` is `undefined` or empty string: skipped entirely
 *   (opt-in — no provider configured means no moderation).
 * - Empty or whitespace-only text: skipped (no provider call made).
 *
 * @module ai-core/engine/moderation-pass
 */

import type { AiFeature, AiProviderId, StreamTextChunk } from '@repo/schemas';
import type { AiProvider, StreamTextResult } from '../providers/ai-provider.interface.js';
import type { AiEngineEvent } from './engine.js';
import { AiModerationBlockedError, AiProviderUnconfiguredError } from './errors.js';

// ---------------------------------------------------------------------------
// runModerationPass — Input type
// ---------------------------------------------------------------------------

/**
 * Input for {@link runModerationPass}.
 */
export interface RunModerationPassInput {
    /**
     * The AI feature context — included in the emitted events and the thrown
     * error so callers can discriminate which feature was blocked.
     */
    readonly feature: AiFeature;

    /**
     * Whether this is an input check (user-supplied text, before generation)
     * or an output check (model-generated text, after generation).
     */
    readonly direction: 'input' | 'output';

    /**
     * The text to evaluate.
     *
     * Empty or whitespace-only text is skipped — no provider call is made.
     */
    readonly text: string;

    /**
     * The configured moderation provider ID.
     *
     * When `undefined` or empty string, the pass is skipped entirely (opt-in
     * moderation — no provider configured means no moderation). When set, it
     * is passed to `getProvider` to obtain the concrete adapter.
     */
    readonly moderationProviderId: AiProviderId | undefined;

    /**
     * Provider factory injected from the engine.
     *
     * Only called when `moderationProviderId` is set. The factory may throw
     * `AiProviderUnconfiguredError` when the configured moderation provider has
     * no resolvable credential — that case fails CLOSED (the error is re-thrown,
     * the request is blocked). Any other throw is a transient failure and fails
     * OPEN (moderation error event, call continues). See the module doc for the
     * full fail-open/fail-closed contract.
     */
    readonly getProvider: (id: AiProviderId) => AiProvider;

    /**
     * Optional event sink for routing/moderation events.
     *
     * When provided, the pass emits `moderation_blocked` or `moderation_error`
     * events. When absent, events are silently dropped.
     */
    readonly recordEvent?: (event: AiEngineEvent) => void;
}

// ---------------------------------------------------------------------------
// runModerationPass — Implementation
// ---------------------------------------------------------------------------

/**
 * Runs one moderation pass for an AI capability call.
 *
 * **Behaviour**:
 * 0. If `moderationProviderId` is `undefined` or empty string, returns
 *    immediately (opt-in — no provider configured means no moderation).
 * 1. If `text` is empty or whitespace-only, returns immediately (no-op).
 * 2. Calls `getProvider(moderationProviderId).moderate({ input: text })`.
 * 3. If the result is flagged: emits a `moderation_blocked` event and throws
 *    `AiModerationBlockedError` with the flagged categories.
 * 4. If `moderate()` throws (or `getProvider()` throws) a TRANSIENT error: emits
 *    a `moderation_error` event and returns normally (fail-open — the AI call
 *    continues unmoderated). EXCEPTION: `AiProviderUnconfiguredError` (no
 *    resolvable credential for the configured provider) is re-thrown (fail-CLOSED).
 * 5. If the result is clean: returns normally.
 *
 * **Input text for the three capabilities**:
 * - `generateText` / `generateObject`: the caller passes the user-supplied
 *   `prompt` and/or the concatenated `user`-role messages.
 * - `extractIntent`: the caller passes `request.query`.
 * - Output passes: the caller passes `response.text` or
 *   `JSON.stringify(response.object)`.
 *
 * **Why extracted here (not inline in engine.ts)**:
 * `engine.ts` is already > 700 lines. Extracting this helper keeps both files
 * under the 500-line project limit while maintaining a single code path for all
 * three capabilities.
 *
 * @param input - {@link RunModerationPassInput}
 * @returns A promise that resolves when the text is clean or skipped.
 * @throws {AiModerationBlockedError} If the moderation provider flagged the text.
 * @throws {AiProviderUnconfiguredError} If the configured moderation provider has
 *   no resolvable credential (fail-CLOSED — a provider was set but its key is
 *   missing; this is a real misconfiguration, not an opt-in absence).
 */
export async function runModerationPass(input: RunModerationPassInput): Promise<void> {
    const { feature, direction, text, moderationProviderId, getProvider, recordEvent } = input;

    // 0. Opt-in skip: no provider configured → moderation disabled, return normally.
    if (!moderationProviderId) {
        return;
    }

    // 1. Skip empty / whitespace-only text — no provider call needed.
    if (text.trim().length === 0) {
        return;
    }

    try {
        // 2. Resolve the provider (may throw if unconfigured — handled below).
        const provider = getProvider(moderationProviderId);

        // 3. Call the moderation endpoint.
        const result = await provider.moderate({ input: text });

        if (result.flagged) {
            // 4a. Flagged — emit event and throw.
            recordEvent?.({
                type: 'moderation_blocked',
                feature,
                direction,
                categories: result.categories
            });
            throw new AiModerationBlockedError({
                feature,
                direction,
                categories: result.categories
            });
        }

        // 5. Clean — return normally.
    } catch (err) {
        // Re-throw AiModerationBlockedError immediately — it is a deliberate block,
        // not a provider failure.
        if (err instanceof AiModerationBlockedError) {
            throw err;
        }

        // Re-throw AiProviderUnconfiguredError (fail-CLOSED). If the admin
        // explicitly configured a moderation provider but its credential is
        // missing, the provider is misconfigured — block the request rather than
        // silently proceeding unmoderated. This is the ONLY non-block error that
        // is NOT swallowed; transient failures below still fail-open.
        // Note: when NO provider is configured at all (opt-in absent), we never
        // reach this point because step 0 above returns early.
        if (err instanceof AiProviderUnconfiguredError) {
            throw err;
        }

        // 4b. Any other (transient) error (network failure, timeout, rate-limit,
        //     5xx, etc.) → fail-open: emit error event and let the AI call continue.
        const message = err instanceof Error ? err.message : String(err);
        recordEvent?.({
            type: 'moderation_error',
            feature,
            direction,
            errorMessage: message
        });
    }
}

// ---------------------------------------------------------------------------
// buildInputModerationText — Helper
// ---------------------------------------------------------------------------

/**
 * Builds the text string to moderate from a `generateText`-style request.
 *
 * Only user-supplied content is moderated:
 * - `prompt` if supplied (single-shot path).
 * - All `messages` entries with `role === 'user'`, joined by `\n` (multi-turn path).
 *
 * System messages (`role === 'system'`) are OUR own prompts and are NOT moderated.
 * Assistant messages (`role === 'assistant'`) are prior model turns and are NOT
 * moderated as input (they may be moderated as output in a future spec).
 *
 * @param prompt - Optional plain-text prompt from the request.
 * @param messages - Optional message array from the request.
 * @returns The concatenated user content to moderate. Empty string if nothing to moderate.
 */
export function buildInputModerationText(
    prompt: string | undefined,
    messages: ReadonlyArray<{ readonly role: string; readonly content: string }> | undefined
): string {
    if (prompt !== undefined) {
        return prompt;
    }
    if (messages !== undefined && messages.length > 0) {
        const userParts = messages.filter((m) => m.role === 'user').map((m) => m.content);
        return userParts.join('\n');
    }
    return '';
}

// ---------------------------------------------------------------------------
// wrapStreamWithOutputModeration — Output moderation for streamText (T-024)
// ---------------------------------------------------------------------------

/**
 * Input for {@link wrapStreamWithOutputModeration}.
 */
export interface WrapStreamWithOutputModerationInput {
    /**
     * The raw `StreamTextResult` returned by `routeWithFallback`.
     * The wrapper drains this stream, yielding each chunk to the consumer,
     * and runs the output moderation pass once the stream ends naturally.
     */
    readonly result: StreamTextResult;

    /**
     * The AI feature context — included in the emitted events and the thrown
     * error so callers can discriminate which feature was blocked.
     */
    readonly feature: AiFeature;

    /**
     * The configured moderation provider ID.
     *
     * When `undefined` or empty string, output moderation is skipped (opt-in).
     */
    readonly moderationProviderId: AiProviderId | undefined;

    /**
     * Provider factory injected from the engine.
     */
    readonly getProvider: (id: AiProviderId) => AiProvider;

    /**
     * Optional event sink for moderation events.
     */
    readonly recordEvent?: (event: AiEngineEvent) => void;
}

/**
 * Wraps a `StreamTextResult` with output moderation applied at drain.
 *
 * **Behaviour**:
 * 1. Yields every chunk from the underlying stream to the consumer unchanged.
 * 2. Accumulates the full text via `chunk.delta` concatenation.
 * 3. When the underlying stream ends naturally, runs `runModerationPass` on
 *    the accumulated text (`direction: 'output'`).
 * 4. If flagged: emits a `moderation_blocked` event then the generator throws
 *    `AiModerationBlockedError` after the last token, so the SSE consumer
 *    can emit an error event and the client can discard the shown content.
 * 5. If the moderation call throws (network error, provider down): emits a
 *    `moderation_error` event and the generator returns normally (fail-open,
 *    identical to T-020 for `generateText`).
 * 6. If accumulated text is empty: skips the moderation pass entirely.
 *
 * The original `meta` promise is forwarded untouched — adapters resolve `meta`
 * after drain and this wrapper fully drains the original stream, so `meta` still
 * resolves correctly.
 *
 * Owner decision (2026-06-05): output moderation at drain + final throw is the
 * approved design. T-029 (SSE route) consumes `service.streamText` and must
 * handle `AiModerationBlockedError` thrown from the async generator.
 *
 * @param input - {@link WrapStreamWithOutputModerationInput}
 * @returns A new `StreamTextResult` whose `stream` includes output moderation.
 *
 * @throws {AiModerationBlockedError} Thrown from within the async generator
 *   after the last token if the output is flagged by the moderation provider.
 */
export function wrapStreamWithOutputModeration(
    input: WrapStreamWithOutputModerationInput
): StreamTextResult {
    const { result, feature, moderationProviderId, getProvider, recordEvent } = input;

    async function* moderatedStream(): AsyncGenerator<StreamTextChunk> {
        let accumulated = '';

        for await (const chunk of result.stream) {
            accumulated += chunk.delta;
            yield chunk;
        }

        // Skip moderation pass if nothing was accumulated.
        if (accumulated.trim().length === 0) {
            return;
        }

        // Run output moderation after all chunks have been yielded.
        // runModerationPass throws AiModerationBlockedError when flagged,
        // or records moderation_error and returns (fail-open) on provider errors.
        await runModerationPass({
            feature,
            direction: 'output',
            text: accumulated,
            moderationProviderId,
            getProvider,
            recordEvent
        });
    }

    return {
        stream: moderatedStream(),
        meta: result.meta
    };
}
