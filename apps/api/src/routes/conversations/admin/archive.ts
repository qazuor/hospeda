/**
 * PATCH /api/v1/admin/conversations/:id/archive
 *
 * Toggles the OWNER-side archived state of a conversation.
 * Requires CONVERSATION_UPDATE_STATUS_OWN.
 */

import {
    ArchiveConversationSchema,
    ConversationSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

/** System-level actor used for service permission checks. */
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
 * PATCH /:id/archive
 * Toggles archivedByOwner for the conversation.
 * Returns the updated conversation row.
 */
router.patch('/:id/archive', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const actor = getActorFromContext(c);

        const hasUpdateOwn = actor.permissions.includes(
            PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN
        );

        if (!hasUpdateOwn) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.FORBIDDEN,
                    message:
                        'Permission denied: CONVERSATION_UPDATE_STATUS_OWN required to archive conversations'
                },
                c,
                403
            );
        }

        const rawBody = await c.req.json().catch(() => null);
        const parseResult = ArchiveConversationSchema.safeParse(rawBody);

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

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.archive(SYSTEM_ACTOR, {
            conversationId,
            side: 'OWNER',
            archived: body.archived
        });

        if (result.error) {
            const status = result.error.code === ServiceErrorCode.NOT_FOUND ? 404 : 400;
            return createErrorResponse(
                {
                    code: result.error.code,
                    message: result.error.message
                },
                c,
                status
            );
        }

        return createResponse(result.data, c, 200, ConversationSchema);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as archiveAdminConversationRoute };
