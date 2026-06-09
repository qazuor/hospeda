/**
 * AI accommodation-chat streaming route (SPEC-200 T-004).
 *
 * Mounted at `POST /api/v1/protected/ai/chat` by the protected-AI barrel.
 * Serves the tourist-facing accommodation assistant on the detail page.
 *
 * ## Middleware order (CRITICAL — wrong order = 503 on every request)
 *
 * `createProtectedStreamingRoute` prepends `protectedAuthMiddleware`, so the
 * effective order is:
 *
 *   auth → entitlement → rateLimit-perUser → rateLimit-perIP → quota
 *
 * `entitlementMiddleware()` MUST run before `createAiQuotaMiddleware('chat')`
 * because the quota middleware reads `c.get('userEntitlements')`.
 *
 * ## Flow
 *
 * 1. Validate `AiChatRequestSchema` (1..20 messages, locale optional).
 * 2. Resolve the actor from context.
 * 3. Resolve the admin/default system prompt for `chat`.
 * 4. Assemble the accommodation-scoped context and system message.
 * 5. Prepend `messages[0].role === 'system'` (caller-wins injection).
 * 6. Stream tokens from `aiService.streamText({ feature: 'chat', messages, locale })`.
 * 7. After drain, race `persistChatTurn(...)` vs 1500 ms and add
 *    `conversationId` to the `done` frame only on win.
 *
 * ## Analytics
 *
 * Server-side PostHog events (no PII / no message content):
 * - `ai_chat_opened`
 * - `ai_chat_message_sent`
 * - `ai_chat_response_completed`
 * - `ai_chat_moderation_blocked`
 * - `ai_chat_cap_reached`
 *
 * @module apps/api/routes/ai/protected/chat
 */

import { resolveFeatureConfig, resolveSystemPrompt } from '@repo/ai-core';
import {
    AI_CHAT_MAX_MESSAGES,
    type AiChatMessage,
    type AiChatRequest,
    AiChatRequestSchema,
    type AiFeature,
    type AiMessage,
    type LanguageEnum,
    PermissionEnum
} from '@repo/schemas';
import { getPostHogClient } from '../../../lib/posthog.js';
import { createAiQuotaMiddleware } from '../../../middlewares/ai-quota';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit';
import { entitlementMiddleware } from '../../../middlewares/entitlement';
import { assembleAccommodationContext } from '../../../services/accommodation-ai-context.js';
import { persistChatTurn } from '../../../services/ai-chat-persistence.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { mapAiEngineErrorToHttpStatus } from '../../../utils/ai-error-mapper.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    type StreamTextChunk,
    createProtectedStreamingRoute
} from '../../../utils/streaming-route-factory.js';

const FEATURE: AiFeature = 'chat';
const DEFAULT_LOCALE: LanguageEnum = 'es';
const PERSISTENCE_TIMEOUT_MS = 1500;

/**
 * Default per-call output token cap for the chat feature.
 *
 * Applied when the admin feature config does NOT carry an explicit
 * `params.maxTokens` value. Bounds the cost of a single chat answer so an
 * unlimited-quota tier cannot trigger an unbounded-output cost bomb. The
 * resolved feature-config value (when present) always wins over this default.
 */
const DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 1024;

/**
 * Resolves the per-call output token cap for the chat feature.
 *
 * Prefers the admin-configured `features.chat.params.maxTokens` when present,
 * falling back to {@link DEFAULT_CHAT_MAX_OUTPUT_TOKENS}. Config-resolution
 * failures are non-fatal: the call still proceeds with the safe default so a
 * transient settings read cannot take the chat feature down — the cap is a
 * cost guard, not a correctness gate.
 */
async function resolveChatMaxOutputTokens(): Promise<number> {
    try {
        const featureConfig = await resolveFeatureConfig({ feature: FEATURE });
        return featureConfig.params.maxTokens ?? DEFAULT_CHAT_MAX_OUTPUT_TOKENS;
    } catch (error) {
        apiLogger.warn(
            { feature: FEATURE, error: error instanceof Error ? error.message : String(error) },
            'ai-chat: failed to resolve feature config for maxTokens cap; using default'
        );
        return DEFAULT_CHAT_MAX_OUTPUT_TOKENS;
    }
}

interface ChatPostHogProperties {
    readonly accommodationId: string;
    readonly locale: LanguageEnum;
    readonly messageCount?: number;
    readonly conversationId?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly promptTokens?: number;
    readonly completionTokens?: number;
}

function captureChatEvent(actorId: string, event: string, properties: ChatPostHogProperties): void {
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

function toEngineMessages(
    systemMessage: string,
    messages: ReadonlyArray<AiChatMessage>
): AiMessage[] {
    return [
        { role: 'system', content: systemMessage },
        ...messages.map((message) => ({ role: message.role, content: message.content }))
    ];
}

function getLastUserTurn(messages: ReadonlyArray<AiChatMessage>): string {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    return lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? '';
}

export const protectedAiChatRoute = createProtectedStreamingRoute({
    path: '/',
    summary: 'AI accommodation chat (streaming SSE)',
    description:
        'Answers tourist questions about a specific accommodation using scoped accommodation context. ' +
        'Streams the answer token-by-token via Server-Sent Events. ' +
        'Gated by the `ai_chat` billing entitlement and per-plan monthly quota.',
    tags: ['AI - Chat'],
    requestSchema: AiChatRequestSchema,
    options: {
        middlewares: [
            entitlementMiddleware(),
            ...createAiRateLimitMiddlewares(FEATURE),
            createAiQuotaMiddleware(FEATURE)
        ]
    },
    streamHandler: async ({ c }) => {
        const body = (await c.req.json()) as AiChatRequest;
        const actor = getActorFromContext(c);
        const locale = body.locale ?? DEFAULT_LOCALE;

        if (body.messages.length === 1) {
            captureChatEvent(actor.id, 'ai_chat_opened', {
                accommodationId: body.accommodationId,
                locale
            });
        }

        if (body.messages.length === AI_CHAT_MAX_MESSAGES) {
            captureChatEvent(actor.id, 'ai_chat_cap_reached', {
                accommodationId: body.accommodationId,
                locale
            });
        }

        const { content: resolvedPrompt } = await resolveSystemPrompt({ feature: FEATURE });
        const { contextBlock, systemMessage } = await assembleAccommodationContext({
            actor,
            accommodationId: body.accommodationId,
            resolvedPrompt,
            locale
        });

        const aiService = await createConfiguredAiService();
        const messages = toEngineMessages(systemMessage, body.messages);
        const maxTokens = await resolveChatMaxOutputTokens();

        captureChatEvent(actor.id, 'ai_chat_message_sent', {
            accommodationId: body.accommodationId,
            messageCount: body.messages.length,
            locale,
            ...(body.conversationId ? { conversationId: body.conversationId } : {})
        });

        const { stream: rawStream, meta } = await aiService.streamText({
            feature: FEATURE,
            messages,
            locale,
            params: { maxTokens }
        });

        let accumulatedAssistantText = '';

        const stream: AsyncIterable<StreamTextChunk> = (async function* () {
            try {
                for await (const chunk of rawStream) {
                    accumulatedAssistantText += chunk.delta;
                    yield chunk;
                }
            } catch (error) {
                const aiMapping = mapAiEngineErrorToHttpStatus(error);
                if (aiMapping?.code === 'MODERATION_BLOCKED') {
                    captureChatEvent(actor.id, 'ai_chat_moderation_blocked', {
                        accommodationId: body.accommodationId,
                        locale
                    });
                }
                throw error;
            }
        })();

        const augmentedMeta = meta.then(async (resolvedMeta) => {
            let resolvedConversationId: string | null = null;

            try {
                const persistPromise = persistChatTurn({
                    userId: actor.id,
                    accommodationId: body.accommodationId,
                    conversationId: body.conversationId ?? null,
                    userMessage: getLastUserTurn(body.messages),
                    assistantMessage: accumulatedAssistantText,
                    meta: resolvedMeta
                }).then((result) => result.conversationId);

                const timeoutPromise = new Promise<null>((resolve) => {
                    setTimeout(() => resolve(null), PERSISTENCE_TIMEOUT_MS);
                });

                resolvedConversationId = await Promise.race([persistPromise, timeoutPromise]);

                if (resolvedConversationId === null) {
                    apiLogger.warn(
                        {
                            accommodationId: body.accommodationId,
                            timeoutMs: PERSISTENCE_TIMEOUT_MS
                        },
                        'ai-chat: persistence timed out after 1500 ms (non-fatal)'
                    );
                }
            } catch (error) {
                apiLogger.error(
                    {
                        accommodationId: body.accommodationId,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'ai-chat: persistence failed (non-fatal)'
                );
            }

            captureChatEvent(actor.id, 'ai_chat_response_completed', {
                accommodationId: body.accommodationId,
                locale,
                provider: resolvedMeta.provider,
                model: resolvedMeta.model,
                promptTokens: resolvedMeta.usage.promptTokens,
                completionTokens: resolvedMeta.usage.completionTokens
            });

            return {
                ...resolvedMeta,
                ...(resolvedConversationId ? { conversationId: resolvedConversationId } : {})
            };
        });

        // Emit the debug frame only to actors holding AI_SETTINGS_MANAGE so the
        // admin playground inspection panel can display the system prompt and
        // accommodation context.  Tourist callers receive no debug field at all
        // — the streaming factory suppresses the debug SSE event when undefined.
        const isAiAdmin = actor.permissions.includes(PermissionEnum.AI_SETTINGS_MANAGE);

        return {
            stream,
            meta: augmentedMeta,
            ...(isAiAdmin
                ? {
                      debug: {
                          contextBlock,
                          resolvedPrompt,
                          systemMessage,
                          feature: FEATURE,
                          accommodationId: body.accommodationId
                      }
                  }
                : {})
        };
    }
});
