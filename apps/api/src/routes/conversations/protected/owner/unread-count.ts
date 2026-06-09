/**
 * GET /api/v1/protected/conversations/owner/unread-count
 *
 * Returns the number of conversations with unread activity for the
 * authenticated owner, scoped to their accommodations.
 */

import { accommodations, getDb } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
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
 * GET /unread-count
 * Returns `{ count: number }` for the authenticated owner's inbox badge.
 */
router.get('/unread-count', async (c) => {
    try {
        const actor = getActorFromContext(c);

        // Permission gate: require CONVERSATION_VIEW_OWN
        if (!actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: conversation view permission required'
                },
                c,
                403
            );
        }

        // Resolve accommodation IDs for this owner
        const db = getDb();
        const rows = await db
            .select({ id: accommodations.id })
            .from(accommodations)
            .where(eq(accommodations.ownerId, actor.id));
        const accommodationIds = rows.map((r) => r.id);

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.getUnreadCount(SYSTEM_ACTOR, {
            actorId: actor.id,
            actorSide: 'OWNER',
            accommodationIds
        });

        if (result.error) {
            return createErrorResponse(
                {
                    code: result.error.code,
                    message: result.error.message
                },
                c,
                400
            );
        }

        return createResponse(result.data, c, 200);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as unreadCountOwnerConversationRoute };
