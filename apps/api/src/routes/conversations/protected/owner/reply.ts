/**
 * POST /api/v1/protected/conversations/owner/:id/messages
 *
 * Appends a new OWNER-side message to an existing conversation from an
 * authenticated owner. Requires CONVERSATION_REPLY_OWN permission.
 * Returns 404 (not 403) when the conversation is not in the owner's
 * accommodations (anti-enumeration pattern).
 */

import { accommodations, getDb } from '@repo/db';
import {
    CreateMessageSchema,
    MessageSenderTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ConversationService, MessageService } from '@repo/service-core';
import { eq } from 'drizzle-orm';
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

        // Resolve owner accommodation IDs for ownership check
        const db = getDb();
        const accRows = await db
            .select({ id: accommodations.id })
            .from(accommodations)
            .where(eq(accommodations.ownerId, actor.id));
        const ownerAccommodationIds = accRows.map((r) => r.id);

        // Verify ownership via getThread (anti-enumeration: 404 for non-owned)
        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const ownCheck = await conversationSvc.getThread(
            SYSTEM_ACTOR,
            { conversationId, actorSide: 'OWNER', limit: 1 },
            ownerAccommodationIds
        );

        if (ownCheck.error) {
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

        // Additional ownership check: conversation must be in owner's accommodations
        const convAccommodationId = (ownCheck.data.conversation as { accommodationId: string })
            .accommodationId;
        if (!ownerAccommodationIds.includes(convAccommodationId)) {
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

        return createResponse(msgResult.data, c, 201);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as replyOwnerConversationRoute };
