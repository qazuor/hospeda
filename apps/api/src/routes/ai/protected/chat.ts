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
 * 6. After drain, `finalizeChatTurn` (`chat.finalize.ts`): `recordAiUsage` ONCE
 *     (HOS-2095), owner-keyed (`userId`) with the tourist on `consumerUserId`
 *     (fire-and-try, non-fatal).
 * 7. It races `persistChatTurn(...)` vs 1500 ms; the route adds
 *     `conversationId` to the `done` frame only on win.
 *
 * HOS-2100 split the helpers (`chat.helpers.ts`) and the post-stream
 * finalization (`chat.finalize.ts`) out of this file; the flow is unchanged.
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

import { composeSystemPrompt, resolveSystemPrompt } from '@repo/ai-core';
import { accommodations, experiences, getDb, venues } from '@repo/db';
import {
    AI_CHAT_MAX_MESSAGES,
    type AiChatRequest,
    AiChatRequestSchema,
    type AiFeature,
    type LanguageEnum,
    PermissionEnum,
    resolveAiChatTarget,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { resolveListingSections } from '@repo/verticals';
import { eq } from 'drizzle-orm';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit';
import {
    CHAT_CONTEXT_ASSEMBLERS,
    CHAT_FEATURE_BY_ENTITY_TYPE
} from '../../../services/ai-context/index.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { mapAiEngineErrorToHttpStatus } from '../../../utils/ai-error-mapper.js';
import { enforceAiQuota } from '../../../utils/listing-access/ai-quota-gate.js';
import { getListingAccessPorts } from '../../../utils/listing-access/ports.js';
import {
    createProtectedStreamingRoute,
    type StreamTextChunk
} from '../../../utils/streaming-route-factory.js';
import { finalizeChatTurn } from './chat.finalize.js';
import {
    captureChatEvent,
    getLastUserTurn,
    resolveChatMaxOutputTokens,
    toEngineMessages
} from './chat.helpers.js';

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
    venue: 'venue.aiChat.unavailable',
    experience: 'experience.aiChat.unavailable'
} as const;

const VERTICAL_BY_ENTITY_TYPE = {
    accommodation: VerticalEnum.ACCOMMODATION,
    venue: VerticalEnum.VENUE,
    experience: VerticalEnum.EXPERIENCE
} as const;

const OWNER_CHAT_LIMIT_BY_ENTITY_TYPE = {
    accommodation: 'max_ai_chat_per_month',
    venue: 'max_ai_chat_venue_per_month',
    experience: 'max_ai_chat_experience_per_month'
} as const;

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
            venue: venues,
            experience: experiences
        } as const;
        const listingTable = LISTING_TABLE_BY_ENTITY_TYPE[entityType];
        const rows = await db
            .select({ ownerId: listingTable.ownerId, businessLines: listingTable.businessLines })
            .from(listingTable)
            .where(eq(listingTable.id, entityId))
            .limit(1);

        const ownerRow = rows[0] as
            | { ownerId: string; businessLines?: readonly string[] | null }
            | undefined;
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
            limitMessage: 'El propietario ha alcanzado el límite mensual de chats de IA.'
        });
        await enforceAiQuota({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            feature: ownerFeature,
            limitKey: 'max_ai_chat_consumer_per_month',
            limitMessage: 'accommodations.aiChat.consumerLimitReached',
            // HOS-2095: the tourist's chats live on the owner-keyed row's
            // `consumer_user_id`. Counting by `user_id` would read the rows
            // billed to this user AS AN OWNER (other tourists' questions on
            // their listings) instead of the questions they asked.
            countKeyedBy: 'consumer'
        });

        const listingSections = (() => {
            switch (entityType) {
                case 'venue':
                case 'experience':
                    return resolveListingSections({
                        vertical: entityType,
                        businessLines: ownerRow.businessLines ?? [],
                        effective: ownerEffectiveSet,
                        userId: ownerId
                    }).sections;
                case 'accommodation':
                    return new Map();
                default: {
                    const exhaustive: never = entityType;
                    throw new Error(`Unsupported chat entity type: ${exhaustive}`);
                }
            }
        })();

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
            listingSections
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
            const { conversationId: resolvedConversationId } = await finalizeChatTurn({
                resolvedMeta,
                assistantText: accumulatedAssistantText,
                feature: FEATURE,
                entityType,
                entityId,
                ownerId,
                actorId: actor.id,
                locale,
                conversationId: body.conversationId ?? null,
                userMessage: getLastUserTurn(body.messages),
                handlerStartMs
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
                          // What the model actually received, language line included.
                          systemMessage: engineSystem,
                          feature: FEATURE,
                          entityId
                      }
                  }
                : {})
        };
    }
});
