/**
 * POST /api/v1/protected/conversations/owner/:id/messages
 *
 * Appends a new OWNER-side message to an existing conversation from an
 * authenticated owner. Requires CONVERSATION_REPLY_OWN permission.
 * Returns 404 (not 403) when the conversation is not in the owner's
 * accommodations (anti-enumeration pattern).
 */

import {
    CreateMessageSchema,
    MessageSchema,
    MessageSenderTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ConversationService, MessageService } from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import { getActorFromContext } from '../../../../utils/actor';
import { createRouter } from '../../../../utils/create-app';
import { env } from '../../../../utils/env';
import { apiLogger } from '../../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../../utils/response-helpers';
import { SYSTEM_ACTOR } from './system-actor';

const router = createRouter();

const conversationSvc = new ConversationService(
    { logger: apiLogger },
    {
        authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
        siteUrl: env.HOSPEDA_SITE_URL
    }
);

/**
 * POST /:id/messages
 * Posts an OWNER-side message to a conversation.
 * Returns the created message row with status 201.
 */
router.post('/:id/messages', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const actor = getActorFromContext(c);

        // Permission gate: require CONVERSATION_REPLY_OWN
        if (!actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN)) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: conversation reply permission required'
                },
                c,
                403
            );
        }

        // Parse request body
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

        // Lightweight ownership check (no getThread side effects): the
        // conversation must exist AND belong to one of the owner's accommodations.
        const ownership = await conversationSvc.findOwnedConversation(actor, { conversationId });

        // Only "not yours / not there" answers 404. Any other service failure keeps
        // its own status (error-contract.md: a 5xx is never masked as 404).
        if (
            ownership.error &&
            ownership.error.code !== ServiceErrorCode.NOT_FOUND &&
            ownership.error.code !== ServiceErrorCode.FORBIDDEN
        ) {
            // Keep the service's own code and status. `handleRouteError` masks the
            // message of anything that resolves to a 5xx (HOS-2296).
            throw new ServiceError(ownership.error.code, ownership.error.message);
        }

        if (ownership.error || !ownership.data) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Conversation not found',
                    reason: 'CONVERSATION_NOT_FOUND'
                },
                c,
                404
            );
        }

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

export { router as replyOwnerConversationRoute };
