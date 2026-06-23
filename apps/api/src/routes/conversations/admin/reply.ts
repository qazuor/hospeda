/**
 * POST /api/v1/admin/conversations/:id/messages
 *
 * Appends a new OWNER-side message to an existing conversation from an admin actor.
 * Requires CONVERSATION_REPLY_OWN or CONVERSATION_REPLY_ANY.
 */

import {
    CreateMessageSchema,
    MessageSchema,
    MessageSenderTypeEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { MessageService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

/** System-level actor used for message write service calls. */
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
 * POST /:id/messages
 * Posts an OWNER-side message to a conversation.
 * Returns the created message row with status 201.
 */
router.post('/:id/messages', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const actor = getActorFromContext(c);

        const hasReplyOwn = actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN);
        const hasReplyAny = actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_ANY);

        if (!hasReplyOwn && !hasReplyAny) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: conversation reply permission required'
                },
                c,
                403
            );
        }

        const rawBody = await c.req.json().catch(() => null);
        const parseResult = CreateMessageSchema.safeParse(rawBody);

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

        const messageSvc = new MessageService({ logger: apiLogger });
        const msgResult = await messageSvc.createMessage(SYSTEM_ACTOR, {
            conversationId,
            senderType: MessageSenderTypeEnum.OWNER,
            body: body.body,
            userId: actor.id
        });

        if (msgResult.error) {
            // Content moderation errors map to 422 Unprocessable Entity
            const status = msgResult.error.code === ServiceErrorCode.VALIDATION_ERROR ? 422 : 400;
            return createErrorResponse(
                {
                    code: msgResult.error.code,
                    message: msgResult.error.message
                },
                c,
                status
            );
        }

        return createResponse(msgResult.data, c, 201, MessageSchema);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as replyAdminConversationRoute };
