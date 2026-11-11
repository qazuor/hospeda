/** Owner dismissal actions for AI listing questions (HOS-2105). */
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import {
    isQuestionOwnedBy,
    setQuestionDismissed
} from '../../../services/ai-listing-questions.service.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { createProtectedRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod.js';

const response = z
    .object({ messageId: z.string().uuid(), ownerDismissedAt: z.string().datetime().nullable() })
    .strict();

/** Creates one idempotent dismiss or undo endpoint. */
export function createListingQuestionDismissRoute(input: { readonly dismissed: boolean }) {
    return createProtectedRoute({
        method: 'post',
        path: '/',
        summary: input.dismissed
            ? 'Dismiss an AI listing question'
            : 'Undo AI listing question dismissal',
        description: 'Updates the dismissal state of an owned AI listing question.',
        tags: ['AI - Chat'],
        requestParams: { messageId: z.string().uuid() },
        responseSchema: response,
        successStatusCode: 200,
        handler: async (ctx, params) => {
            const actor = getActorFromContext(ctx);
            const messageId = String(params.messageId);
            if (!(await isQuestionOwnedBy({ messageId, userId: actor.id })).owned) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Question not found.');
            }
            const result = await setQuestionDismissed({
                messageId,
                userId: actor.id,
                dismissed: input.dismissed
            });
            return {
                messageId,
                ownerDismissedAt: result.ownerDismissedAt?.toISOString() ?? null
            };
        },
        options: { customRateLimit: { requests: 60, windowMs: 60_000 } }
    });
}
