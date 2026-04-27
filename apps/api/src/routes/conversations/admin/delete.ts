/**
 * DELETE /api/v1/admin/conversations/:id
 *
 * Soft-deletes a conversation with a 4-step cascade:
 * 1. conversations.deleted_at = now()
 * 2. messages.deleted_at = now()
 * 3. Access tokens revoked
 * 4. Notification schedules cancelled
 *
 * Requires CONVERSATION_DELETE_ANY — no self-service delete in MVP.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse, handleRouteError } from '../../../utils/response-helpers';

/** System-level actor used for delete service calls. */
const SYSTEM_ACTOR = {
    id: '00000000-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_VIEW_ALL,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
        PermissionEnum.CONVERSATION_BLOCK_OWN,
        PermissionEnum.CONVERSATION_BLOCK_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY
    ] as readonly PermissionEnum[],
    _isSystemActor: true
} as const;

const router = createRouter();

/**
 * DELETE /:id
 * Soft-deletes a conversation with full cascade.
 * Returns 204 No Content on success.
 */
router.delete('/:id', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const actor = getActorFromContext(c);

        const hasDeleteAny = actor.permissions.includes(PermissionEnum.CONVERSATION_DELETE_ANY);

        if (!hasDeleteAny) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.FORBIDDEN,
                    message:
                        'Permission denied: CONVERSATION_DELETE_ANY required to delete conversations'
                },
                c,
                403
            );
        }

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.softDelete(SYSTEM_ACTOR, { conversationId });

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

        return c.body(null, 204);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as deleteAdminConversationRoute };
