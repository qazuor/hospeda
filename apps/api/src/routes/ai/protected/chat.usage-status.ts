/**
 * Usage-status resolution for the AI chat route (HOS-2095).
 *
 * A reasoning model can spend its whole output-token budget on hidden
 * reasoning and finish (`finishReason: 'length'`) with ZERO visible text.
 * Quota is counted from `success | fallback` `ai_usage` rows, so recording
 * such a turn as `success` would burn the owner's and the tourist's quota
 * for an answer nobody received.
 *
 * @module routes/ai/protected/chat.usage-status
 */

/** `ai_usage.status` values the chat route records. */
export type ChatUsageStatus = 'success' | 'error';

/**
 * Resolves the `ai_usage.status` for a drained chat stream.
 *
 * A turn counts as `success` only when it delivered visible text. A
 * non-empty answer truncated by `length` still delivered text, so it stays
 * `success`. The finish reason is deliberately NOT part of the decision: an
 * empty answer is never billable whatever the provider reported.
 *
 * @param input - The accumulated assistant text.
 * @returns `{ status, isEmpty }`
 */
export function resolveChatUsageStatus(input: { readonly text: string }): {
    readonly status: ChatUsageStatus;
    readonly isEmpty: boolean;
} {
    const isEmpty = input.text.trim() === '';
    return { status: isEmpty ? 'error' : 'success', isEmpty };
}
