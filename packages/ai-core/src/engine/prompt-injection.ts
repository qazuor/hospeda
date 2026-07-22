/**
 * System-prompt injection helpers for the AI engine (SPEC-173 §5.6.3, T-034).
 *
 * Provides `injectSystemPrompt`, a pure transformation that inserts the resolved
 * system prompt into a `GenerateTextRequest` or `StreamTextRequest` using the
 * **caller-wins** policy:
 *
 * - If the caller already supplied a `system` string, OR a message with
 *   `role: 'system'`, the request is returned UNCHANGED — the caller knows
 *   what they are doing. The `role: 'system'` message check is preserved for
 *   callers that still build their own `messages` array.
 * - Otherwise, the resolved system prompt is injected via the SDK's native
 *   `system` field (HOS-205), leaving the caller's `prompt` / `messages`
 *   payload untouched:
 *   - **prompt-path** (`prompt` field) — `{ prompt } → { system, prompt }`.
 *   - **messages-path** (`messages` field) — `{ messages } → { system, messages }`.
 *
 * Injecting a `role: 'system'` entry into `messages` (the previous behavior)
 * tripped the Vercel AI SDK's "System messages in the prompt or messages fields
 * can be a security risk ... Use the system option instead" warning; the
 * provider adapters already forward `input.system` to that native channel.
 *
 * `generateObject` has only a `prompt` field and no `messages`, so its
 * injection is handled inline in the engine (system content concatenated into
 * the prompt string — no `role: 'system'` message, so no SDK warning).
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
    readonly system?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the caller already supplied their own system
 * instructions — either via the `system` field or a `role: 'system'`
 * message in `messages`.
 *
 * Checking `req.system` first lets callers use the SDK's native system
 * channel without ever populating `messages` with a system-role entry. The
 * `messages` check is preserved for callers that still build their own
 * system-role message; the `prompt` path has no system concept of its own.
 *
 * @param req - The request to inspect.
 * @returns `true` if `system` is set, or at least one message has
 *   `role === 'system'`.
 */
function hasCallerSystemMessage(req: PromptOrMessagesRequest): boolean {
    if (req.system !== undefined) {
        return true;
    }
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
 * If the request already contains a `system` string, OR a message with
 * `role: 'system'`, the original request is returned UNCHANGED.  Callers who
 * craft their own system content (e.g. capability helpers that build bespoke
 * system context) are trusted to know what they are doing; the engine never
 * overwrites their intent.
 *
 * ## Injection paths
 *
 * When no caller system content exists, the resolved prompt is placed in the
 * SDK-native `system` field (HOS-205) and the caller's `prompt` / `messages`
 * payload is left as-is — no `role: 'system'` message is ever synthesized:
 *
 * | Path | Before | After |
 * |------|--------|-------|
 * | `prompt` | `{ prompt: 'hello' }` | `{ system: content, prompt: 'hello' }` |
 * | `messages` | `{ messages: [{ role:'user', content:'hello' }] }` | `{ system: content, messages: [{ role:'user', content:'hello' }] }` |
 *
 * The `prompt` / `messages` discriminator is preserved, so provider adapters
 * still branch correctly on `prompt !== undefined`; the added `system` field is
 * forwarded to the SDK's native system-instructions channel by both adapters.
 *
 * **Schema validity**: `GenerateTextRequestSchema` uses `.superRefine` to
 * enforce exactly-one-of `prompt` / `messages`. Injection only adds the
 * independent `system` field, so that invariant still holds (and injection runs
 * post-validation regardless).
 *
 * @param input - {@link InjectSystemPromptInput}
 * @returns The request with `system` set to the resolved prompt, or `T` unchanged when the caller already supplied their own system content.
 *
 * @example
 * ```ts
 * // prompt-path:
 * injectSystemPrompt({ req: { feature: 'chat', locale: 'es', prompt: 'Hi' }, systemContent: 'You are...' })
 * // → { feature: 'chat', locale: 'es', prompt: 'Hi', system: 'You are...' }
 *
 * // messages-path with existing system (caller-wins):
 * injectSystemPrompt({ req: { feature: 'chat', locale: 'es', messages: [{ role:'system', content:'My custom prompt' }, { role:'user', content:'Hi' }] }, systemContent: 'ignored' })
 * // → same request unchanged
 * ```
 */
export function injectSystemPrompt<T extends PromptOrMessagesRequest>(
    input: InjectSystemPromptInput<T>
): T {
    const { req, systemContent } = input;

    // Caller-wins: if the caller already provided a system message, pass through.
    if (hasCallerSystemMessage(req)) {
        return req;
    }

    // HOS-205: inject the resolved system prompt via the Vercel AI SDK's native
    // `system` channel, NOT as a `role: 'system'` entry inside `messages`. A
    // system message embedded in `messages` (or `prompt`) trips the SDK warning
    // "System messages in the prompt or messages fields can be a security risk
    // because they may enable prompt injection attacks. Use the system option
    // instead" (observed x3 on draft auto-translation). The caller's `prompt` /
    // `messages` payload is left untouched; the provider adapters already forward
    // `input.system` to the SDK's system-instructions option, so this is exactly
    // the "use the system option instead" remediation the warning asks for.
    return { ...req, system: systemContent } as T;
}
