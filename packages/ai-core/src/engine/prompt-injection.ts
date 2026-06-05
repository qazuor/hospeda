/**
 * System-prompt injection helpers for the AI engine (SPEC-173 §5.6.3, T-034).
 *
 * Provides `injectSystemPrompt`, a pure transformation that inserts the resolved
 * system prompt into a `GenerateTextRequest` or `StreamTextRequest` using the
 * **caller-wins** policy:
 *
 * - If the caller already supplied a message with `role: 'system'`, the request
 *   is returned UNCHANGED — the caller knows what they are doing.
 * - Otherwise, the resolved system prompt is injected automatically:
 *   - **prompt-path** (`prompt` field) — converted to
 *     `messages: [{ role: 'system', content }, { role: 'user', content: prompt }]`.
 *   - **messages-path** (`messages` field) — the system message is prepended:
 *     `[{ role: 'system', content }, ...existingMessages]`.
 *
 * `generateObject` has only a `prompt` field and no `messages`, so its
 * injection is handled inline in the engine with the simpler prompt-path logic.
 * `extractIntent` constructs its own fully-formed prompt string internally and
 * calls `generateObject`, so it is excluded from injection (injecting there
 * would double-wrap the prompt in a system message).
 *
 * ## Placement rationale
 *
 * This module lives in `engine/` rather than `config/` because it operates on
 * engine request types (`GenerateTextRequest`, `StreamTextRequest`) and is only
 * consumed by `engine.ts`.  Placing it here avoids a confusing upward dependency
 * from `config/` into `engine/`.  It does NOT import `@repo/db` or any SDK —
 * the resolved `content` string is passed in by the engine caller (AC-4 clean).
 *
 * @module ai-core/engine/prompt-injection
 */

import type { AiMessage } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * A request type that supports either `prompt` or `messages` (the two
 * prompt paths on `GenerateTextRequest` and `StreamTextRequest`).
 *
 * This intersection type is used internally by `injectSystemPrompt` to accept
 * both request types without a union-typed overload.
 */
type PromptOrMessagesRequest = {
    readonly prompt?: string;
    readonly messages?: readonly AiMessage[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the request already contains a `system` role message.
 *
 * Checks the `messages` array only — the `prompt` path has no system concept.
 *
 * @param req - The request to inspect.
 * @returns `true` if at least one message has `role === 'system'`.
 */
function hasCallerSystemMessage(req: PromptOrMessagesRequest): boolean {
    if (req.messages === undefined) {
        return false;
    }
    return req.messages.some((m) => m.role === 'system');
}

// ---------------------------------------------------------------------------
// I/O shape
// ---------------------------------------------------------------------------

/**
 * Input for {@link injectSystemPrompt}.
 */
export interface InjectSystemPromptInput<T extends PromptOrMessagesRequest> {
    /** The original request from the caller. */
    readonly req: T;
    /** The resolved system-prompt content (from the prompt-resolver). */
    readonly systemContent: string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Injects a resolved system prompt into a `generateText` or `streamText`
 * request using the **caller-wins** policy.
 *
 * ## Caller-wins policy
 *
 * If the request already contains a message with `role: 'system'`, the
 * original request is returned UNCHANGED.  Callers who craft their own system
 * prompt (e.g. capability helpers that build bespoke system context) are
 * trusted to know what they are doing; the engine never overwrites their intent.
 *
 * ## Injection paths
 *
 * When no caller system message exists, injection proceeds based on which
 * path the request uses:
 *
 * | Path | Before | After |
 * |------|--------|-------|
 * | `prompt` | `{ prompt: 'hello' }` | `{ messages: [{ role:'system', content }, { role:'user', content:'hello' }] }` |
 * | `messages` | `{ messages: [{ role:'user', content:'hello' }] }` | `{ messages: [{ role:'system', content }, { role:'user', content:'hello' }] }` |
 *
 * The converted `messages`-path result has the `prompt` field absent —
 * provider adapters branch on `prompt !== undefined` so removing it ensures
 * they use the correct `messages` code path.
 *
 * **Schema validity**: `GenerateTextRequestSchema` uses `.superRefine` to
 * enforce exactly-one-of `prompt` / `messages`.  After injection, the returned
 * object always has `messages` and no `prompt`, satisfying the schema.
 *
 * @param input - {@link InjectSystemPromptInput}
 * @returns The (possibly modified) request.  The type is `Omit<T, 'prompt'> & { messages: AiMessage[] }` after injection, or `T` unchanged when the caller already supplied a system message.
 *
 * @example
 * ```ts
 * // prompt-path:
 * injectSystemPrompt({ req: { feature: 'chat', locale: 'es', prompt: 'Hi' }, systemContent: 'You are...' })
 * // → { feature: 'chat', locale: 'es', messages: [{ role:'system', content:'You are...' }, { role:'user', content:'Hi' }] }
 *
 * // messages-path with existing system (caller-wins):
 * injectSystemPrompt({ req: { feature: 'chat', locale: 'es', messages: [{ role:'system', content:'My custom prompt' }, { role:'user', content:'Hi' }] }, systemContent: 'ignored' })
 * // → same request unchanged
 * ```
 */
export function injectSystemPrompt<T extends PromptOrMessagesRequest>(
    input: InjectSystemPromptInput<T>
): T | (Omit<T, 'prompt'> & { readonly messages: readonly AiMessage[] }) {
    const { req, systemContent } = input;

    // Caller-wins: if the caller already provided a system message, pass through.
    if (hasCallerSystemMessage(req)) {
        return req;
    }

    const systemMessage: AiMessage = { role: 'system', content: systemContent };

    if (req.prompt !== undefined) {
        // prompt-path → convert to messages form, drop the prompt field.
        // Destructure to explicitly drop 'prompt'; spread the rest.
        const { prompt: _droppedPrompt, ...rest } = req;
        const userMessage: AiMessage = { role: 'user', content: req.prompt };
        return {
            ...rest,
            messages: [systemMessage, userMessage]
        } as Omit<T, 'prompt'> & { readonly messages: readonly AiMessage[] };
    }

    // messages-path → prepend the system message.
    const existingMessages = req.messages ?? [];
    return {
        ...req,
        messages: [systemMessage, ...existingMessages]
    } as T | (Omit<T, 'prompt'> & { readonly messages: readonly AiMessage[] });
}
