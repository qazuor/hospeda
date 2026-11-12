/**
 * Helpers of the listing-chat route (`chat.ts`), split out by HOS-2100 to keep
 * the route under the 500-line limit. Behaviour is unchanged: these are the
 * output-cap resolution, the analytics capture and the mapping of the request
 * into the engine's `system` + `messages` pair.
 *
 * @module apps/api/routes/ai/protected/chat.helpers
 */

import { appendReplyLanguageInstruction, resolveFeatureConfig } from '@repo/ai-core';
import type { AiChatMessage, AiFeature, AiMessage, LanguageEnum } from '@repo/schemas';
import { getPostHogClient } from '../../../lib/posthog.js';
import { apiLogger } from '../../../utils/logger.js';

/**
 * Default per-call output token cap for the chat feature.
 *
 * Applied when the admin feature config does NOT carry an explicit
 * `params.maxTokens` value. Bounds the cost of a single chat answer so an
 * unlimited-quota tier cannot trigger an unbounded-output cost bomb. The
 * resolved feature-config value (when present) always wins over this default.
 */
export const DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 1024;

/**
 * Resolves the per-call output token cap for the chat feature.
 *
 * Prefers the admin-configured `features.chat.params.maxTokens` when present,
 * falling back to {@link DEFAULT_CHAT_MAX_OUTPUT_TOKENS}. Config-resolution
 * failures are non-fatal: the call still proceeds with the safe default so a
 * transient settings read cannot take the chat feature down — the cap is a
 * cost guard, not a correctness gate.
 */
export async function resolveChatMaxOutputTokens(feature: AiFeature): Promise<number> {
    try {
        const featureConfig = await resolveFeatureConfig({ feature });
        return featureConfig.params.maxTokens ?? DEFAULT_CHAT_MAX_OUTPUT_TOKENS;
    } catch (error) {
        apiLogger.warn(
            { feature, error: error instanceof Error ? error.message : String(error) },
            'ai-chat: failed to resolve feature config for maxTokens cap; using default'
        );
        return DEFAULT_CHAT_MAX_OUTPUT_TOKENS;
    }
}

/** Server-side PostHog properties of a chat event (no PII, no message content). */
export interface ChatPostHogProperties {
    readonly entityId: string;
    readonly locale: LanguageEnum;
    readonly messageCount?: number;
    readonly conversationId?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly promptTokens?: number;
    readonly completionTokens?: number;
}

/**
 * Captures one server-side chat analytics event. A no-op when PostHog is not
 * configured.
 */
export function captureChatEvent(
    actorId: string,
    event: string,
    properties: ChatPostHogProperties
): void {
    const client = getPostHogClient();
    if (!client) {
        return;
    }

    client.capture({
        distinctId: actorId,
        event,
        properties
    });
}

/**
 * Result of {@link toEngineMessages}: the assembled `system` content plus the
 * mapped conversation `messages`, ready for `aiService.streamText({ system,
 * messages })`.
 *
 * `messages` never contains a `role: 'system'` entry — the accommodation
 * context + resolved prompt is forwarded via the engine's native `system`
 * option instead of a mid-array system message (avoids the AI SDK's
 * security-risk warning for stacked system messages).
 */
export interface EngineMessages {
    readonly system: string;
    readonly messages: AiMessage[];
}

/**
 * Maps the request into the engine's `system` + `messages` pair.
 *
 * HOS-2095 (round 2): the reply language is decided HERE, from the visitor's
 * latest message, and appended as the last line of `system` (see
 * `appendReplyLanguageInstruction` in `@repo/ai-core`). When the message is too
 * short or mixed to decide, `system` is the assembler's message unchanged.
 */
export function toEngineMessages(
    systemMessage: string,
    messages: ReadonlyArray<AiChatMessage>
): EngineMessages {
    const { system } = appendReplyLanguageInstruction({
        system: systemMessage,
        latestUserMessage: getLastUserTurn(messages)
    });
    return {
        system,
        messages: messages.map((message) => ({ role: message.role, content: message.content }))
    };
}

/**
 * Content of the visitor's latest user turn, or `''` when the request carries
 * none. It never falls back to an assistant turn (review of #4253): that text
 * is the model's own, so it must neither decide the reply language nor be
 * persisted as what the visitor said.
 */
export function getLastUserTurn(messages: ReadonlyArray<AiChatMessage>): string {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    return lastUserMessage?.content ?? '';
}
