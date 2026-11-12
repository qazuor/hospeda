import { AiFaqDraftResponseSchema, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { resolveListingSections } from '@repo/verticals';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit.js';
import { generateFaqDraft, readFaqDraftQuestion } from '../../../services/ai-faq-draft.service.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { meterAiUsage } from '../../../utils/ai-usage-metering.js';
import { enforceAiQuota } from '../../../utils/listing-access/ai-quota-gate.js';
import { getListingAccessPorts } from '../../../utils/listing-access/ports.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod.js';

const FEATURE = 'faq_draft' as const;
const VERTICAL_BY_ENTITY_TYPE = {
    accommodation: VerticalEnum.ACCOMMODATION,
    venue: VerticalEnum.VENUE,
    experience: VerticalEnum.EXPERIENCE
} as const;

/** On-demand AI answer draft for an unanswered or unclassified listing question. */
export const protectedAiListingQuestionFaqDraftRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Generate a suggested FAQ answer',
    description:
        'Creates an editable, listing-grounded FAQ answer draft for an owned listing question.',
    tags: ['AI - Chat'],
    requestParams: { messageId: z.string().uuid() },
    responseSchema: AiFaqDraftResponseSchema,
    successStatusCode: 200,
    options: { middlewares: createAiRateLimitMiddlewares(FEATURE) },
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const messageId = String(params.messageId);
        const question = await readFaqDraftQuestion({ messageId });
        if (!question || question.ownerId !== actor.id)
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Question not found.');
        if (question.answerStatus === 'answered')
            throw new ServiceError(
                ServiceErrorCode.FAQ_DRAFT_NOT_ELIGIBLE,
                'This question already has an answer.'
            );
        const vertical = VERTICAL_BY_ENTITY_TYPE[question.entityType];
        const effectiveSet = await getListingAccessPorts().effectiveSet({
            userId: actor.id,
            vertical
        });
        await enforceAiQuota({
            userId: actor.id,
            vertical,
            feature: FEATURE,
            entitlementKey: 'ai_faq_draft',
            limitKey: 'max_ai_faq_draft_per_month',
            effectiveSetSnapshot: effectiveSet
        });
        const listingSections =
            question.entityType === 'accommodation'
                ? new Map()
                : resolveListingSections({
                      vertical: question.entityType,
                      businessLines: question.businessLines,
                      effective: effectiveSet,
                      userId: actor.id
                  }).sections;
        try {
            const generated = await generateFaqDraft({
                context: question,
                actor,
                locale: 'es',
                listingSections
            });
            if (generated.usage)
                await meterAiUsage({
                    userId: actor.id,
                    feature: FEATURE,
                    ...generated.usage,
                    status: 'success'
                });
            return generated.response;
        } catch (error) {
            await meterAiUsage({
                userId: actor.id,
                feature: FEATURE,
                provider: 'unknown',
                model: 'unknown',
                promptTokens: 0,
                completionTokens: 0,
                latencyMs: 0,
                status: 'error'
            });
            throw error;
        }
    }
});
