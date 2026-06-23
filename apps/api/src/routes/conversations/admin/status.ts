/**
 * PATCH /api/v1/admin/conversations/:id/status
 *
 * Changes the lifecycle status of a conversation.
 * Permission requirements depend on the target status:
 * - CLOSED or OPEN (non-blocked): CONVERSATION_UPDATE_STATUS_OWN or _ANY
 * - BLOCKED:                      CONVERSATION_BLOCK_OWN or _ANY
 * - Transition FROM BLOCKED:      CONVERSATION_UPDATE_STATUS_ANY only (admin override)
 *
 * Passes `ownerAccommodationIds` to the service for the OWN scope check.
 * Actors with _ANY permissions bypass the accommodation scope check.
 */

import { getDb } from '@repo/db';
import { accommodations } from '@repo/db';
import {
    ConversationSchema,
    ConversationStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    UpdateConversationStatusSchema
} from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

const router = createRouter();

/**
 * PATCH /:id/status
 * Transitions a conversation to the requested status.
 * Returns the updated conversation row.
 */
router.patch('/:id/status', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const actor = getActorFromContext(c);

        const rawBody = await c.req.json().catch(() => null);
        const parseResult = UpdateConversationStatusSchema.safeParse(rawBody);

        if (!parseResult.success) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Invalid request body',
                    details: parseResult.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message
                    }))
                },
                c,
                400
            );
        }

        const body = parseResult.data;
        const targetStatus = body.status;

        // Conditional permission check based on target status
        const hasUpdateOwn = actor.permissions.includes(
            PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN
        );
        const hasUpdateAny = actor.permissions.includes(
            PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY
        );
        const hasBlockOwn = actor.permissions.includes(PermissionEnum.CONVERSATION_BLOCK_OWN);
        const hasBlockAny = actor.permissions.includes(PermissionEnum.CONVERSATION_BLOCK_ANY);

        // Determine if this is a transition FROM BLOCKED (admin-only override)
        // We cannot check current status here without fetching the conversation,
        // so we delegate the BLOCKED-origin check to service layer permission logic.
        // However, we still gate at the route level:
        if (targetStatus === ConversationStatusEnum.BLOCKED) {
            if (!hasBlockOwn && !hasBlockAny) {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.FORBIDDEN,
                        message:
                            'Permission denied: block permission required to set BLOCKED status'
                    },
                    c,
                    403
                );
            }
        } else {
            // CLOSED, OPEN, PENDING_OWNER, etc.
            if (!hasUpdateOwn && !hasUpdateAny) {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.FORBIDDEN,
                        message: 'Permission denied: conversation update-status permission required'
                    },
                    c,
                    403
                );
            }
        }

        // Resolve ownerAccommodationIds for service-layer scope check.
        // Actors with ANY permission pass empty array (bypass scope check).
        let ownerAccommodationIds: string[] = [];

        const hasAnyPermission = hasUpdateAny || hasBlockAny;
        if (!hasAnyPermission) {
            const db = getDb();
            const rows = await db
                .select({ id: accommodations.id })
                .from(accommodations)
                .where(eq(accommodations.ownerId, actor.id));
            ownerAccommodationIds = rows.map((r) => r.id);
        }

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.updateStatus(
            actor,
            {
                conversationId,
                status: targetStatus,
                blockReason: body.blockReason
            },
            ownerAccommodationIds
        );

        if (result.error) {
            if (result.error.code === ServiceErrorCode.NOT_FOUND) {
                return createErrorResponse(
                    {
                        code: result.error.code,
                        message: 'Conversation not found',
                        reason: 'CONVERSATION_NOT_FOUND'
                    },
                    c,
                    404
                );
            }
            return createErrorResponse(
                {
                    code: result.error.code,
                    message: result.error.message
                },
                c,
                400
            );
        }

        return createResponse(result.data, c, 200, ConversationSchema);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as statusAdminConversationRoute };
