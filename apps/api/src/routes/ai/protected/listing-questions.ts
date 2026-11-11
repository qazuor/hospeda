/**
 * GET /api/v1/protected/ai/listing-questions?entityType=&entityId= (HOS-2101)
 *
 * The questions tourists asked one listing's AI chat, for that listing's owner.
 *
 * Refusal order (apps/api/docs/error-contract.md): no session → 401 (the
 * protected tier's auth gate), malformed query → 400 (Zod, before any database
 * read), missing / deleted / foreign listing → 404. Foreign is 404 and never
 * 403: a 403 would confirm the listing id exists to someone who does not own it.
 *
 * Available to every owner — there is no entitlement gate (owner decision): a
 * plan without chat simply has no questions to show.
 *
 * The response is anonymous; see `ai-listing-questions.service.ts`.
 *
 * @module routes/ai/protected/listing-questions
 */

import {
    type AiListingQuestionsQuery,
    AiListingQuestionsQuerySchema,
    AiListingQuestionsResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import {
    isListingOwnedBy,
    listListingQuestions
} from '../../../services/ai-listing-questions.service.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';

export const protectedAiListingQuestionsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'AI chat questions about one of my listings',
    description:
        'Lists, newest first, the questions tourists asked the AI chat of a listing the caller ' +
        'owns, over the last 12 months, with the bot answer and whether it answered. Anonymous: ' +
        'no data identifying the tourist is returned. A listing the caller does not own answers 404.',
    tags: ['AI - Chat'],
    requestQuery: AiListingQuestionsQuerySchema.shape,
    responseSchema: AiListingQuestionsResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { entityType, entityId } = query as AiListingQuestionsQuery;

        const { owned } = await isListingOwnedBy({ entityType, entityId, userId: actor.id });
        if (!owned) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `${entityType} not found.`);
        }

        return listListingQuestions({
            entityType,
            entityId,
            othersCursor: query?.othersCursor as string | undefined
        });
    },
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
