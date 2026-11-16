/**
 * POST /api/v1/protected/ai-connections/reset-review
 *
 * Answers the question the web asks on the first login after a password RESET
 * (forgot-password flow only) when the user had AI assistants connected:
 *
 * - `revoke_previous` disconnects exactly the assistants connected before the
 *   reset and clears the question.
 * - `keep` only clears the question.
 *
 * It is never automatic: nothing is disconnected until the user answers.
 *
 * When there is nothing to answer, including a second call after the first one
 * resolved it, the answer is 409 `ALREADY_EXISTS` with reason
 * `NO_PENDING_RESET_REVIEW` and nothing changes (error-contract.md: a state
 * conflict is a 409).
 *
 * @route POST /api/v1/protected/ai-connections/reset-review
 * @module routes/ai-connection/protected/reset-review
 */
import {
    AiConnectionResetReviewBodySchema,
    type AiConnectionResetReviewResult,
    AiConnectionResetReviewResultSchema
} from '@repo/schemas';
import { AiConnectionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const aiConnectionService = new AiConnectionService({ logger: apiLogger });

/**
 * POST /api/v1/protected/ai-connections/reset-review
 * Disconnect the pre-reset assistants, or keep them. Owner-scoped.
 */
export const resolveResetReviewRoute = createProtectedRoute({
    method: 'post',
    path: '/reset-review',
    summary: 'Answer the post-password-reset AI assistants question',
    description:
        'After a password reset, the user may disconnect the AI assistants connected before it (`revoke_previous`) or keep them (`keep`). Either answer clears the question. 409 when there is nothing to answer.',
    tags: ['AI Connections'],
    requestBody: AiConnectionResetReviewBodySchema,
    successStatusCode: 200,
    responseSchema: AiConnectionResetReviewResultSchema,
    options: {
        customRateLimit: { requests: 30, windowMs: 60000 }
    },
    handler: async (ctx, _params, body): Promise<AiConnectionResetReviewResult> => {
        const actor = getActorFromContext(ctx);
        const { action } = body as { action: AiConnectionResetReviewResult['action'] };

        const result = await aiConnectionService.resolveResetReview(actor, { action });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                result.error.details,
                result.error.reason
            );
        }

        for (const entry of result.data?.removedByClient ?? []) {
            auditLog({
                auditEvent: AuditEventType.MCP_CONNECTION_REVOKED,
                actorId: actor.id,
                resourceType: 'oauth_client',
                resourceId: entry.clientId,
                removed: entry.removed,
                reason: 'PASSWORD_RESET_REVIEW'
            });
        }

        return {
            action: result.data?.action ?? action,
            revokedClientIds: [...(result.data?.revokedClientIds ?? [])]
        };
    }
});
