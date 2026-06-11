/**
 * AI accommodation-chat streaming route (SPEC-200 T-004, SPEC-211 T-009).
 *
 * Mounted at `POST /api/v1/protected/ai/chat` by the protected-AI barrel.
 * Serves the tourist-facing accommodation assistant on the detail page.
 *
 * ## Middleware order (CRITICAL — wrong order = 503 on every request)
 *
 * `createProtectedStreamingRoute` prepends `protectedAuthMiddleware`, so the
 * effective order is:
 *
 *   auth → entitlement → rateLimit-perUser → rateLimit-perIP
 *
 * `entitlementMiddleware()` loads the requesting tourist's entitlements for
 * other purposes. The AI_CHAT gate and quota are now evaluated INLINE in the
 * handler against the **listing owner** (SPEC-211 Phase 1, §7.3), NOT the
 * tourist. The `createAiQuotaMiddleware('chat')` is intentionally removed:
 * it was tourist-keyed and cannot be reused for owner-governed metering.
 *
 * Per-tourist + per-IP rate limiting (`createAiRateLimitMiddlewares('chat')`)
 * is preserved as the burst guard (still keyed by the requesting tourist).
 *
 * ## Flow (SPEC-211 Phase 1 §7.3)
 *
 * 1. Validate `AiChatRequestSchema` (1..20 messages, locale optional).
 * 2. Resolve the actor from context.
 * 3. Fetch `ownerId` from the accommodation row (pre-stream 404 guard).
 * 4. Resolve owner entitlements + limits in parallel.
 * 5. Gate: owner lacks `AI_CHAT` → 403 `ENTITLEMENT_REQUIRED` (pre-stream).
 * 6. Quota: `ownerLimit === -1` → unlimited; else count owner's monthly usage;
 *    count >= ownerLimit → 403 `LIMIT_REACHED` (pre-stream).
 * 7. Assemble the accommodation-scoped context and system message.
 * 8. Stream tokens from `aiService.streamText({ feature: 'chat', messages, locale })`.
 * 9. After drain, `recordAiUsage({ userId: ownerId, ... })` (owner-metered).
 * 10. Race `persistChatTurn(...)` vs 1500 ms and add `conversationId` to the
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
    getMonthlyCallCount,
    recordAiUsage,
    resolveFeatureConfig,
    resolveSystemPrompt
} from '@repo/ai-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { accommodations, getDb } from '@repo/db';
import {
    AI_CHAT_MAX_MESSAGES,
    type AiChatMessage,
    type AiChatRequest,
    AiChatRequestSchema,
    type AiFeature,
    type AiMessage,
    type LanguageEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { getPostHogClient } from '../../../lib/posthog.js';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit';
import { entitlementMiddleware } from '../../../middlewares/entitlement';
import {
    resolveOwnerEntitlementsForOwnerId,
    resolveOwnerLimitsForOwnerId
} from '../../../middlewares/owner-entitlement.js';
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
        "Gated by the listing owner's `ai_chat` billing entitlement and per-owner monthly quota (SPEC-211).",
    tags: ['AI - Chat'],
    requestSchema: AiChatRequestSchema,
    options: {
        middlewares: [
            entitlementMiddleware(),
            ...createAiRateLimitMiddlewares(FEATURE)
            // NOTE (SPEC-211 Phase 1): `createAiQuotaMiddleware('chat')` is intentionally
            // removed from here. It was tourist-keyed and cannot be reused for
            // owner-governed metering. The AI_CHAT gate + quota are enforced inline below
            // against the listing owner (§7.3), BEFORE streaming starts.
        ]
    },
    streamHandler: async ({ c }) => {
        const body = (await c.req.json()) as AiChatRequest;
        const actor = getActorFromContext(c);
        const locale = body.locale ?? DEFAULT_LOCALE;
        const now = new Date();
        const handlerStartMs = Date.now();

        // -----------------------------------------------------------------------
        // Step 1: Resolve ownerId from the accommodation row (pre-stream 404 guard).
        //
        // This is the seam described in SPEC-211 §7.3 step 1. The accommodation
        // must exist before we can determine whose quota to check. A missing
        // accommodation throws ServiceError(NOT_FOUND) which the factory maps to
        // HTTP 404 before any SSE bytes are written.
        // -----------------------------------------------------------------------
        const db = getDb();
        const rows = await db
            .select({ ownerId: accommodations.ownerId })
            .from(accommodations)
            .where(eq(accommodations.id, body.accommodationId))
            .limit(1);

        const ownerRow = rows[0] as { ownerId: string } | undefined;
        if (!ownerRow) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found.', {
                accommodationId: body.accommodationId
            });
        }
        const ownerId = ownerRow.ownerId;

        // -----------------------------------------------------------------------
        // Step 2: Resolve owner entitlements + limits in parallel (SPEC-211 §7.3).
        //
        // Both functions are cached 5 min per QZPay customerId — no per-request
        // billing round-trip overhead on warm traffic.
        // -----------------------------------------------------------------------
        const [ownerEntitlements, ownerLimits] = await Promise.all([
            resolveOwnerEntitlementsForOwnerId(ownerId),
            resolveOwnerLimitsForOwnerId(ownerId)
        ]);

        // -----------------------------------------------------------------------
        // Step 3: Entitlement gate (pre-stream) — SPEC-211 §7.3 step 3.
        //
        // If the listing owner's plan does not include AI_CHAT, the tourist
        // sees the OQ-8 copy: "AI chat is not available for this accommodation".
        // We throw ServiceError so the global error handler maps it to HTTP 403
        // with code ENTITLEMENT_REQUIRED — consistent with the rest of the API.
        // -----------------------------------------------------------------------
        if (!ownerEntitlements.includes(EntitlementKey.AI_CHAT)) {
            apiLogger.warn(
                { ownerId, accommodationId: body.accommodationId },
                'ai-chat: blocked — owner lacks AI_CHAT entitlement'
            );
            throw new ServiceError(
                ServiceErrorCode.ENTITLEMENT_REQUIRED,
                'accommodations.aiChat.unavailable',
                { requiredEntitlement: EntitlementKey.AI_CHAT }
            );
        }

        // -----------------------------------------------------------------------
        // Step 4: Quota check (pre-stream) — SPEC-211 §7.3 step 4.
        //
        // ownerLimit === -1  → unlimited (staff owners via INV-6 bypass); skip count.
        // ownerLimit === 0   → feature disabled in plan (deny immediately).
        // ownerLimit === N   → finite monthly budget; compare vs. actual usage.
        //
        // After Phase 0, no real plan should carry -1 for AI features, but the
        // check is kept for correctness (staff bypass still produces -1).
        // -----------------------------------------------------------------------
        const ownerLimit = ownerLimits.get(LimitKey.MAX_AI_CHAT_PER_MONTH) ?? 0;

        if (ownerLimit !== -1) {
            if (ownerLimit === 0) {
                apiLogger.warn(
                    { ownerId, accommodationId: body.accommodationId },
                    'ai-chat: blocked — owner chat limit is 0 (feature disabled in plan)'
                );
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    'El chat de IA no está disponible en el plan del alojamiento.',
                    {
                        limitKey: LimitKey.MAX_AI_CHAT_PER_MONTH,
                        currentCount: 0,
                        maxAllowed: 0
                    }
                );
            }

            const ownerUsed = await getMonthlyCallCount({
                userId: ownerId,
                feature: FEATURE,
                now
            });

            if (ownerUsed >= ownerLimit) {
                apiLogger.warn(
                    {
                        ownerId,
                        accommodationId: body.accommodationId,
                        currentCount: ownerUsed,
                        maxAllowed: ownerLimit
                    },
                    'ai-chat: blocked — owner monthly quota reached'
                );
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    'El propietario de este alojamiento ha alcanzado el límite mensual de chats de IA.',
                    {
                        limitKey: LimitKey.MAX_AI_CHAT_PER_MONTH,
                        currentCount: ownerUsed,
                        maxAllowed: ownerLimit
                    }
                );
            }
        }

        // -----------------------------------------------------------------------
        // Gate + quota passed — proceed to streaming.
        // -----------------------------------------------------------------------

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

        const { content, rules } = await resolveSystemPrompt({ feature: FEATURE });
        const resolvedPrompt = composeSystemPrompt({ content, rules });
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

            // -------------------------------------------------------------------
            // Owner-keyed usage metering (SPEC-211 Phase 1 §7.3 step 5).
            //
            // recordAiUsage is keyed by ownerId — the listing owner bears the
            // metered cost, NOT the requesting tourist. This is the central change
            // of SPEC-211 T-009. The call is fire-and-try: a metering failure is
            // logged but must NOT affect the tourist's already-completed stream.
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
                        accommodationId: body.accommodationId,
                        error:
                            meteringError instanceof Error
                                ? meteringError.message
                                : String(meteringError)
                    },
                    'ai-chat: failed to record owner usage (non-fatal — stream already complete)'
                );
            }

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
