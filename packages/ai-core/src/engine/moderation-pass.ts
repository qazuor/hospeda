/**
 * Content-moderation pass for the AI routing engine (SPEC-173 T-020).
 *
 * This module provides a single internal helper, {@link runModerationPass}, that
 * is called by the three capabilities that require moderation:
 *
 * - `generateText`  — input + output moderation.
 * - `generateObject` — input + output moderation (output is JSON-stringified).
 * - `extractIntent`  — input-only moderation (output is an internal typed intent).
 *
 * ## Fail-open guarantee
 *
 * If the moderation provider call throws for ANY reason (network error, provider
 * down, `getProvider` throws because the moderation provider is unconfigured),
 * the error is caught, a `moderation_error` event is emitted via `recordEvent`,
 * and the helper returns normally — allowing the capability call to continue
 * unmoderated. Moderation unavailability MUST NOT take down AI features.
 *
 * ## Skip condition
 *
 * Empty or whitespace-only text is skipped entirely (no provider call made).
 *
 * @module ai-core/engine/moderation-pass
 */

import type { AiFeature, AiProviderId } from '@repo/schemas';
import type { AiProvider } from '../providers/ai-provider.interface.js';
import type { AiEngineEvent } from './engine.js';
import { AiModerationBlockedError } from './errors.js';

// ---------------------------------------------------------------------------
// Input type
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
     * Passed to `getProvider` to obtain the concrete adapter.
     */
    readonly moderationProviderId: AiProviderId;

    /**
     * Provider factory injected from the engine.
     *
     * The factory may throw if the moderation provider is unconfigured — that
     * case is handled as a fail-open (moderation error event, call continues).
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
// Helper
// ---------------------------------------------------------------------------

/**
 * Runs one moderation pass for an AI capability call.
 *
 * **Behaviour**:
 * 1. If `text` is empty or whitespace-only, returns immediately (no-op).
 * 2. Calls `getProvider(moderationProviderId).moderate({ input: text })`.
 * 3. If the result is flagged: emits a `moderation_blocked` event and throws
 *    `AiModerationBlockedError` with the flagged categories.
 * 4. If `moderate()` throws (or `getProvider()` throws): emits a `moderation_error`
 *    event and returns normally (fail-open — the AI call continues unmoderated).
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
 */
export async function runModerationPass(input: RunModerationPassInput): Promise<void> {
    const { feature, direction, text, moderationProviderId, getProvider, recordEvent } = input;

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

        // 4b. Any other error (network failure, provider unconfigured, etc.) →
        //     fail-open: emit error event and let the AI call continue.
        const message = err instanceof Error ? err.message : String(err);
        recordEvent?.({
            type: 'moderation_error',
            feature,
            direction,
            errorMessage: message
        });
    }
}

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
