/**
 * Post-stream finalization of one listing-chat turn: usage metering and turn
 * persistence. Split out of `chat.ts` by HOS-2100 (500-line limit); the
 * behaviour is the block that used to live inline in the route's `meta.then`.
 *
 * @module apps/api/routes/ai/protected/chat.finalize
 */

import { recordAiUsage } from '@repo/ai-core';
import type { AiChatEntityType, AiFeature, LanguageEnum, StreamTextFinalMeta } from '@repo/schemas';
import { persistChatTurn } from '../../../services/ai-chat-persistence.js';
import { warnMissingModelRate } from '../../../utils/ai-missing-model-rate.js';
import { loadModelRateOverrides } from '../../../utils/ai-rate-overrides.js';
import { apiLogger } from '../../../utils/logger.js';
import { captureChatEvent } from './chat.helpers.js';
import { resolveChatUsageStatus } from './chat.usage-status.js';

/** How long the `done` frame waits for persistence before giving up on the id. */
export const PERSISTENCE_TIMEOUT_MS = 1500;

/** Input of {@link finalizeChatTurn}. */
export interface FinalizeChatTurnInput {
    /** Final stream metadata from the engine. */
    readonly resolvedMeta: StreamTextFinalMeta;
    /** The assistant's whole answer, accumulated from the stream. */
    readonly assistantText: string;
    /** The chat feature of this vertical (`chat`, `chat_venue`, `chat_experience`). */
    readonly feature: AiFeature;
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    /** The listing owner: bears the cost (`ai_usage.user_id`). */
    readonly ownerId: string;
    /** The visitor who asked (`ai_usage.consumer_user_id`, conversation owner). */
    readonly actorId: string;
    readonly locale: LanguageEnum;
    /** Existing conversation id, or `null` for the first turn. */
    readonly conversationId: string | null;
    /** The visitor's latest message, as persisted. */
    readonly userMessage: string;
    /** `Date.now()` at the start of the handler, for the metered latency. */
    readonly handlerStartMs: number;
}

/**
 * Meters the turn (exactly ONE `ai_usage` row, owner-keyed with the visitor on
 * `consumerUserId`, HOS-2095), persists it unless the answer is empty, and
 * captures `ai_chat_response_completed`. Never throws: metering and persistence
 * failures are logged, because the visitor's stream already completed.
 *
 * @param input - {@link FinalizeChatTurnInput}
 * @returns `{ conversationId }`: the id when persistence won the
 *   {@link PERSISTENCE_TIMEOUT_MS} race, otherwise `null`.
 */
export async function finalizeChatTurn(
    input: FinalizeChatTurnInput
): Promise<{ readonly conversationId: string | null }> {
    const { resolvedMeta, feature, entityId, ownerId, actorId } = input;
    let resolvedConversationId: string | null = null;

    // HOS-2095: an empty answer (e.g. a reasoning model that spent the whole
    // output cap reasoning) must not count against any quota nor be persisted.
    const { status: usageStatus, isEmpty: isEmptyAnswer } = resolveChatUsageStatus({
        text: input.assistantText
    });
    if (isEmptyAnswer) {
        apiLogger.warn(
            {
                feature,
                entityId,
                model: resolvedMeta.model,
                finishReason: resolvedMeta.finishReason,
                completionTokens: resolvedMeta.usage.completionTokens
            },
            'ai-chat: model produced an empty answer (usage recorded as error, turn not persisted)'
        );
    }

    // DB rate overrides (ai_settings.modelRates).
    const rateOverrides = await loadModelRateOverrides();

    // -------------------------------------------------------------------
    // Usage metering: exactly ONE ai_usage row per chat request (HOS-2095).
    //
    // The listing owner bears the cost (`userId: ownerId`, which the
    // owner quota counts); the tourist who asked rides on the same row
    // (`consumerUserId: actorId`, which the consumer quota counts). A
    // second, consumer-keyed row used to be written here with the full
    // tokens and cost, doubling every chat's spend for the cost ceiling
    // and the admin dashboards, and burning a self-chatting owner's
    // quota twice per question.
    //
    // Fire-and-try: a metering failure is logged but must NOT affect the
    // tourist's already-completed stream.
    // -------------------------------------------------------------------
    try {
        await recordAiUsage({
            userId: ownerId,
            consumerUserId: actorId,
            feature,
            provider: resolvedMeta.provider,
            model: resolvedMeta.model,
            promptTokens: resolvedMeta.usage.promptTokens,
            completionTokens: resolvedMeta.usage.completionTokens,
            latencyMs: Date.now() - input.handlerStartMs,
            status: usageStatus,
            rateOverrides,
            onMissingRate: warnMissingModelRate
        });
    } catch (meteringError) {
        apiLogger.warn(
            {
                ownerId,
                userId: actorId,
                entityId,
                error:
                    meteringError instanceof Error ? meteringError.message : String(meteringError)
            },
            'ai-chat: failed to record usage (non-fatal — stream already complete)'
        );
    }

    if (!isEmptyAnswer) {
        try {
            const persistPromise = persistChatTurn({
                userId: actorId,
                entityType: input.entityType,
                entityId,
                conversationId: input.conversationId,
                userMessage: input.userMessage,
                assistantMessage: input.assistantText,
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
    }

    captureChatEvent(actorId, 'ai_chat_response_completed', {
        entityId,
        locale: input.locale,
        provider: resolvedMeta.provider,
        model: resolvedMeta.model,
        promptTokens: resolvedMeta.usage.promptTokens,
        completionTokens: resolvedMeta.usage.completionTokens
    });

    return { conversationId: resolvedConversationId };
}
