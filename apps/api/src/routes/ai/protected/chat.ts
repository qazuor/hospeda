/**
 * AI accommodation-chat streaming route (SPEC-200 T-004, SPEC-211 T-009).
 *
 * Mounted at `POST /api/v1/protected/ai/chat` by the protected-AI barrel.
 * Serves the tourist-facing accommodation assistant on the detail page.
 *
 * ## Middleware order
 *
 * `createProtectedStreamingRoute` prepends `protectedAuthMiddleware`, so the
 * effective order is:
 *
 *   auth → rateLimit-perUser → rateLimit-perIP
 *
 * Per-tourist + per-IP rate limiting (`createAiRateLimitMiddlewares('chat')`)
 * is the burst guard (keyed by the requesting tourist). The entitlement and
 * quota gates were removed with the legacy billing system (HOS-1416); usage
 * metering (`ai_usage`) remains as non-gating telemetry.
 *
 * ## Flow
 *
 * 1. Validate `AiChatRequestSchema` (1..20 messages, locale optional).
 * 2. Resolve the actor from context.
 * 3. Fetch `ownerId` from the target listing row (pre-stream 404 guard).
 * 4. Assemble the listing-scoped context and system message.
 * 5. Stream tokens from `aiService.streamText({ feature, system, messages, locale })`.
 * 6. After drain, `recordAiUsage` TWICE: owner-keyed + consumer-keyed
 *     (telemetry, fire-and-try, non-fatal).
 * 7. Race `persistChatTurn(...)` vs 1500 ms and add `conversationId` to the
 *     `done` frame only on win.
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

import {
    composeSystemPrompt,
    recordAiUsage,
    resolveFeatureConfig,
    resolveSystemPrompt
} from '@repo/ai-core';
import { accommodations, experiences, gastronomies, getDb } from '@repo/db';
import {
    AI_CHAT_MAX_MESSAGES,
    type AiChatMessage,
    type AiChatRequest,
    AiChatRequestSchema,
    type AiFeature,
    type AiMessage,
    type LanguageEnum,
    PermissionEnum,
    resolveAiChatTarget,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { getPostHogClient } from '../../../lib/posthog.js';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit';
import { persistChatTurn } from '../../../services/ai-chat-persistence.js';
import {
    CHAT_CONTEXT_ASSEMBLERS,
    CHAT_FEATURE_BY_ENTITY_TYPE
} from '../../../services/ai-context/index.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { mapAiEngineErrorToHttpStatus } from '../../../utils/ai-error-mapper.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    createProtectedStreamingRoute,
    type StreamTextChunk
} from '../../../utils/streaming-route-factory.js';

const DEFAULT_LOCALE: LanguageEnum = 'es';

/**
 * The feature used for the BURST rate limiter and for admin feature-config
 * resolution at mount time.
 *
 * Deliberately the accommodation value for all three verticals: the rate limiter
 * is a per-tourist/per-IP burst guard, not a quota, and a visitor bouncing
 * between a restaurant page and a hotel page is one visitor whose burst budget
 * should be shared. The QUOTA — which must not be shared — is resolved per
 * request from `CHAT_FEATURE_BY_ENTITY_TYPE`.
 */
const RATE_LIMIT_FEATURE: AiFeature = 'chat';

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
async function resolveChatMaxOutputTokens(feature: AiFeature): Promise<number> {
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

interface ChatPostHogProperties {
    readonly entityId: string;
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
interface EngineMessages {
    readonly system: string;
    readonly messages: AiMessage[];
}

function toEngineMessages(
    systemMessage: string,
    messages: ReadonlyArray<AiChatMessage>
): EngineMessages {
    return {
        system: systemMessage,
        messages: messages.map((message) => ({ role: message.role, content: message.content }))
    };
}

function getLastUserTurn(messages: ReadonlyArray<AiChatMessage>): string {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    return lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? '';
}

// HOS-1352: transitional until V3 (HOS-1357), see PR — removed AI_CHAT entitlement gate.
export const protectedAiChatRoute = createProtectedStreamingRoute({
    path: '/',
    summary: 'AI accommodation chat (streaming SSE)',
    description:
        'Answers tourist questions about a specific listing using scoped context. ' +
        'Streams the answer token-by-token via Server-Sent Events.',
    tags: ['AI - Chat'],
    requestSchema: AiChatRequestSchema,
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
        middlewares: [...createAiRateLimitMiddlewares(RATE_LIMIT_FEATURE)]
    },
    streamHandler: async ({ c }) => {
        const body = (await c.req.json()) as AiChatRequest;
        const actor = getActorFromContext(c);
        const locale = body.locale ?? DEFAULT_LOCALE;
        const handlerStartMs = Date.now();

        // -----------------------------------------------------------------------
        // Step 0 (HOS-400): resolve the target through the shared helper.
        //
        // `entityId` is now an OPTIONAL legacy alias, so reading it
        // directly would resolve to `undefined` for any caller that sends the new
        // `entityId` spelling. `resolveAiChatTarget` is the single place that
        // knows about the alias.
        //
        // The request schema already accepts `entityType: 'gastronomy' |
        // 'experience'`, but this route's per-vertical context assemblers and
        // gastronomy or experience owner-quota lookup are NOT wired yet. A gastronomy or experience target is
        // therefore refused explicitly rather than falling through into the
        // accommodation lookup below, which would 404 while talking about an
        // accommodation nobody asked about. This branch is the seam the
        // assemblers replace; it must not survive the feature.
        // -----------------------------------------------------------------------
        const target = resolveAiChatTarget(body);
        const entityType = target.entityType;
        const entityId = target.entityId;
        const FEATURE = CHAT_FEATURE_BY_ENTITY_TYPE[entityType];

        // -----------------------------------------------------------------------
        // Step 1: Resolve ownerId from the accommodation row (pre-stream 404 guard).
        //
        // This is the seam described in SPEC-211 §7.3 step 1. The accommodation
        // must exist before we can determine whose quota to check. A missing
        // accommodation throws ServiceError(NOT_FOUND) which the factory maps to
        // HTTP 404 before any SSE bytes are written.
        // -----------------------------------------------------------------------
        const db = getDb();
        // Exhaustive lookup, not a binary ternary (HOS-1079): a literal-equality
        // chain keyed on the vertical silently answers the else-branch for every
        // value it does not name. The record is total over `AiChatEntityType`,
        // so the compiler owns the exhaustiveness.
        const LISTING_TABLE_BY_ENTITY_TYPE = {
            accommodation: accommodations,
            gastronomy: gastronomies,
            experience: experiences
        } as const;
        const listingTable = LISTING_TABLE_BY_ENTITY_TYPE[entityType];
        const rows = await db
            .select({ ownerId: listingTable.ownerId })
            .from(listingTable)
            .where(eq(listingTable.id, entityId))
            .limit(1);

        const ownerRow = rows[0] as { ownerId: string } | undefined;
        if (!ownerRow) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `${entityType} not found.`, {
                entityId
            });
        }
        const ownerId = ownerRow.ownerId;

        if (body.messages.length === 1) {
            captureChatEvent(actor.id, 'ai_chat_opened', {
                entityId,
                locale
            });
        }

        if (body.messages.length === AI_CHAT_MAX_MESSAGES) {
            captureChatEvent(actor.id, 'ai_chat_cap_reached', {
                entityId,
                locale
            });
        }

        const { content, rules } = await resolveSystemPrompt({ feature: FEATURE });
        const resolvedPrompt = composeSystemPrompt({ content, rules });
        // Dispatch by vertical through the registry rather than an `if` here:
        // `CHAT_CONTEXT_ASSEMBLERS` is exhaustive over `AiChatEntityType`, so a
        // fourth vertical is a compile error rather than a branch somebody forgets.
        const { contextBlock, systemMessage } = await CHAT_CONTEXT_ASSEMBLERS[entityType]({
            actor,
            entityId,
            resolvedPrompt,
            locale
        });

        const aiService = await createConfiguredAiService();
        const { system: engineSystem, messages: engineMessages } = toEngineMessages(
            systemMessage,
            body.messages
        );
        const maxTokens = await resolveChatMaxOutputTokens(FEATURE);

        captureChatEvent(actor.id, 'ai_chat_message_sent', {
            entityId,
            messageCount: body.messages.length,
            locale,
            ...(body.conversationId ? { conversationId: body.conversationId } : {})
        });

        const { stream: rawStream, meta } = await aiService.streamText({
            feature: FEATURE,
            system: engineSystem,
            messages: engineMessages,
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
                        entityId,
                        locale
                    });
                }
                throw error;
            }
        })();

        const augmentedMeta = meta.then(async (resolvedMeta) => {
            let resolvedConversationId: string | null = null;

            // -------------------------------------------------------------------
            // Owner-keyed usage metering (telemetry).
            //
            // recordAiUsage is keyed by ownerId — the listing owner bears the
            // metered cost. Fire-and-try: a metering failure is logged but must
            // NOT affect the tourist's already-completed stream.
            // -------------------------------------------------------------------
            try {
                await recordAiUsage({
                    userId: ownerId,
                    feature: FEATURE,
                    provider: resolvedMeta.provider,
                    model: resolvedMeta.model,
                    promptTokens: resolvedMeta.usage.promptTokens,
                    completionTokens: resolvedMeta.usage.completionTokens,
                    latencyMs: Date.now() - handlerStartMs,
                    status: 'success'
                });
            } catch (meteringError) {
                apiLogger.warn(
                    {
                        ownerId,
                        entityId,
                        error:
                            meteringError instanceof Error
                                ? meteringError.message
                                : String(meteringError)
                    },
                    'ai-chat: failed to record owner usage (non-fatal — stream already complete)'
                );
            }

            // -------------------------------------------------------------------
            // Consumer-keyed usage metering (telemetry, keyed by actor.id).
            // Same fire-and-try contract as the owner row above.
            // -------------------------------------------------------------------
            try {
                await recordAiUsage({
                    userId: actor.id,
                    feature: FEATURE,
                    provider: resolvedMeta.provider,
                    model: resolvedMeta.model,
                    promptTokens: resolvedMeta.usage.promptTokens,
                    completionTokens: resolvedMeta.usage.completionTokens,
                    latencyMs: Date.now() - handlerStartMs,
                    status: 'success'
                });
            } catch (meteringError) {
                apiLogger.warn(
                    {
                        userId: actor.id,
                        entityId,
                        error:
                            meteringError instanceof Error
                                ? meteringError.message
                                : String(meteringError)
                    },
                    'ai-chat: failed to record consumer usage (non-fatal — stream already complete)'
                );
            }

            try {
                const persistPromise = persistChatTurn({
                    userId: actor.id,
                    entityType,
                    entityId,
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
                            entityId,
                            timeoutMs: PERSISTENCE_TIMEOUT_MS
                        },
                        'ai-chat: persistence timed out after 1500 ms (non-fatal)'
                    );
                }
            } catch (error) {
                apiLogger.error(
                    {
                        entityId,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'ai-chat: persistence failed (non-fatal)'
                );
            }

            captureChatEvent(actor.id, 'ai_chat_response_completed', {
                entityId,
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
                          entityId
                      }
                  }
                : {})
        };
    }
});
