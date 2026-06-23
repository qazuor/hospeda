/**
 * GET /api/v1/protected/conversations/unread-count
 *
 * Returns the number of conversations with unread activity for the
 * authenticated guest. Used for the inbox badge.
 */

import { PermissionEnum, RoleEnum, UnreadCountResponseSchema } from '@repo/schemas';
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
        PermissionEnum.CONVERSATION_VIEW_ANY
    ] as readonly PermissionEnum[],
    _isSystemActor: true
} as const;

const router = createRouter();

/**
 * GET /unread-count
 * Returns `{ count: number }` for the authenticated guest's inbox badge.
 */
router.get('/unread-count', async (c) => {
    try {
        const actor = getActorFromContext(c);

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.getUnreadCount(SYSTEM_ACTOR, {
            actorId: actor.id,
            actorSide: 'GUEST'
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

        return createResponse(result.data, c, 200, UnreadCountResponseSchema);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as unreadCountProtectedConversationRoute };
