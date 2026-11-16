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
import { captureServerAnalyticsEvent } from '../../../lib/analytics-client.js';
import { apiLogger } from '../../../utils/logger.js';
import type { VisitorContext } from '../../../utils/visitor-context.js';

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

/** Server-side analytics properties of a chat event (no PII, no message content). */
export interface ChatAnalyticsProperties {
    /** Id of the chat entity (accommodation, venue or experience). */
    readonly entityId: string;
    /** Locale of the chat widget the visitor is using. */
    readonly locale: LanguageEnum;
    /** Number of messages in the request history (emitted as `messages_count`). */
    readonly messageCount?: number;
    /** Id of the persisted conversation, when one exists. */
    readonly conversationId?: string;
    /** AI provider that served the answer; empty values are mapped to `null`. */
    readonly provider?: string;
    /** Model that served the answer; empty values are mapped to `null`. */
    readonly model?: string;
    /** Prompt tokens consumed by the call. */
    readonly promptTokens?: number;
    /** Completion tokens produced by the call. */
    readonly completionTokens?: number;
}

/** Catalog event names emitted by the listing chat route. */
export type ChatAnalyticsEvent =
    | 'ai_chat_opened'
    | 'ai_chat_cap_reached'
    | 'ai_chat_message_sent'
    | 'ai_chat_moderation_blocked'
    | 'ai_chat_response_completed';

/** Optional trailing options of {@link captureChatEvent}. */
export interface CaptureChatEventOptions {
    /**
     * IP + User-Agent of the visitor, read from the request headers at request
     * time (never from the Hono context afterwards). Omit for non-request events.
     */
    readonly visitor?: VisitorContext | undefined;
}

/**
 * Captures one server-side chat analytics event through the Umami analytics
 * client (catalog-validated, PII-filtered). A no-op when analytics are not
 * configured. Maps the route's camelCase properties to the catalog's snake_case
 * keys (`messageCount` becomes `messages_count`, because the catalog rejects any
 * key matching `message`).
 *
 * @param actorId - Distinct id of the acting user
 * @param event - Catalog event name to emit
 * @param properties - Route-level (camelCase) event properties
 * @param options - Optional extras; `options.visitor` carries the visitor's IP +
 *   User-Agent for Umami session attribution (omit for non-request events)
 */
export function captureChatEvent(
    actorId: string,
    event: ChatAnalyticsEvent,
    properties: ChatAnalyticsProperties,
    options: CaptureChatEventOptions = {}
): void {
    const visitorField = options.visitor ? { visitor: options.visitor } : {};
    const base = {
        accommodation_id: properties.entityId,
        locale: properties.locale
    };
    const messagesCount =
        properties.messageCount === undefined ? {} : { messages_count: properties.messageCount };

    switch (event) {
        case 'ai_chat_opened':
        case 'ai_chat_cap_reached':
            captureServerAnalyticsEvent({
                distinctId: actorId,
                name: event,
                properties: { ...base, ...messagesCount },
                ...visitorField
            });
            return;
        case 'ai_chat_message_sent':
            captureServerAnalyticsEvent({
                distinctId: actorId,
                name: event,
                properties: {
                    ...base,
                    ...messagesCount,
                    ...(properties.conversationId === undefined
                        ? {}
                        : { conversation_id: properties.conversationId })
                },
                ...visitorField
            });
            return;
        case 'ai_chat_moderation_blocked':
            captureServerAnalyticsEvent({
                distinctId: actorId,
                name: event,
                properties: {
                    ...base,
                    ...(properties.conversationId === undefined
                        ? {}
                        : { conversation_id: properties.conversationId })
                },
                ...visitorField
            });
            return;
        case 'ai_chat_response_completed':
            captureServerAnalyticsEvent({
                distinctId: actorId,
                name: event,
                properties: {
                    ...base,
                    provider: properties.provider || null,
                    model: properties.model || null,
                    ...(properties.promptTokens === undefined
                        ? {}
                        : { prompt_tokens: properties.promptTokens }),
                    ...(properties.completionTokens === undefined
                        ? {}
                        : { completion_tokens: properties.completionTokens })
                },
                ...visitorField
            });
            return;
        default: {
            const _exhaustive: never = event;
            return;
        }
    }
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
