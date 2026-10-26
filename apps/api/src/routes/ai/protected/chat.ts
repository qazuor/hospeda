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
 * is the burst guard (keyed by the requesting tourist). The handler separately
 * checks the listing owner's entitlement/quota and the consumer's quota before
 * starting the stream; usage metering remains as telemetry.
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
    ServiceErrorCode,
    VerticalEnum
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
import { enforceAiQuota } from '../../../utils/listing-access/ai-quota-gate.js';
import { getListingAccessPorts } from '../../../utils/listing-access/ports.js';
import { readEffectiveKeys } from '../../../utils/listing-access/user-gate.js';
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

const OWNER_CHAT_COPY_BY_ENTITY_TYPE = {
    accommodation: 'accommodations.aiChat.unavailable',
    gastronomy: 'gastronomy.aiChat.unavailable',
    experience: 'experience.aiChat.unavailable'
} as const;

const VERTICAL_BY_ENTITY_TYPE = {
    accommodation: VerticalEnum.ACCOMMODATION,
    gastronomy: VerticalEnum.VENUE,
    experience: VerticalEnum.EXPERIENCE
} as const;

const OWNER_CAPABILITY_KEYS_BY_ENTITY_TYPE = {
    accommodation: [],
    gastronomy: ['manage_gastronomy_menu'],
    experience: ['manage_experience_directions']
} as const;

const OWNER_CHAT_LIMIT_BY_ENTITY_TYPE = {
    accommodation: 'max_ai_chat_per_month',
    gastronomy: 'max_ai_chat_gastronomy_per_month',
    experience: 'max_ai_chat_experience_per_month'
} as const;

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

export const protectedAiChatRoute = createProtectedStreamingRoute({
    path: '/',
    summary: 'AI accommodation chat (streaming SSE)',
    description:
        'Answers tourist questions about a specific listing using scoped context. ' +
        'Streams the answer token-by-token via Server-Sent Events.',
    tags: ['AI - Chat'],
    requestSchema: AiChatRequestSchema,
    options: {
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
        // The request schema and exhaustive registries support all three
        // verticals; lookup and context assembly stay scoped to the requested type.
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
        const ownerVertical = VERTICAL_BY_ENTITY_TYPE[entityType];
        const ownerFeature = FEATURE;
        const ownerEffectiveSet = await getListingAccessPorts().effectiveSet({
            userId: ownerId,
            vertical: ownerVertical
        });

        await enforceAiQuota({
            userId: ownerId,
            vertical: ownerVertical,
            feature: ownerFeature,
            entitlementKey: 'ai_chat',
            limitKey: OWNER_CHAT_LIMIT_BY_ENTITY_TYPE[entityType],
            entitlementMessage: OWNER_CHAT_COPY_BY_ENTITY_TYPE[entityType],
            effectiveSetSnapshot: ownerEffectiveSet,
            limitMessage:
                'El propietario de este alojamiento ha alcanzado el límite mensual de chats de IA.'
        });
        await enforceAiQuota({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            feature: ownerFeature,
            limitKey: 'max_ai_chat_consumer_per_month',
            limitMessage: 'accommodations.aiChat.consumerLimitReached'
        });

        const ownerCapabilities = await readEffectiveKeys({
            userId: ownerId,
            vertical: ownerVertical,
            keys: OWNER_CAPABILITY_KEYS_BY_ENTITY_TYPE[entityType],
            effectiveSetSnapshot: ownerEffectiveSet
        });

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
            locale,
            ownerCapabilities: {
                manageVenueMenu: ownerCapabilities.manage_gastronomy_menu === true,
                manageExperienceDirections: ownerCapabilities.manage_experience_directions === true
            }
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
