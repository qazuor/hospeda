/**
 * GET /api/v1/protected/conversations/:id
 *
 * Returns a conversation thread for the authenticated guest.
 * Updates `lastReadAtByGuest` and cancels pending notification schedules.
 *
 * Ownership check: returns 404 (not 403) when the conversation belongs to a
 * different user to avoid ID enumeration attacks.
 */

import { AccommodationModel, ConversationModel, UserModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode, ThreadQuerySchema } from '@repo/schemas';
import { ConversationService } from '@repo/service-core';

const accommodationModel = new AccommodationModel();
const userModel = new UserModel();
const conversationModel = new ConversationModel();
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

/** System-level actor used for service calls that require thread-read permissions. */
const SYSTEM_ACTOR = {
    id: '00000000-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY
    ] as readonly PermissionEnum[],
    _isSystemActor: true
} as const;

const router = createRouter();

/**
 * GET /:id
 * Returns the conversation thread and updates the guest read receipt.
 * Returns 404 for both non-existent conversations AND conversations owned
 * by other users (anti-enumeration pattern).
 */
router.get('/:id', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries());
        const parseResult = ThreadQuerySchema.safeParse(rawQuery);

        if (!parseResult.success) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Invalid query parameters',
                    details: parseResult.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message
                    }))
                },
                c,
                400
            );
        }

        const query = parseResult.data;
        const actor = getActorFromContext(c);

        // SECURITY (write-IDOR): validate ownership BEFORE getThread runs its
        // read-receipt + notification-cancel side effects. Unlike the owner
        // route, the guest route CANNOT pass the real actor to getThread,
        // because the USER role does NOT hold CONVERSATION_VIEW_OWN (see
        // rolePermissions.seed.ts) — checkCanViewConversation would reject the
        // legitimate owner. So we gate explicitly on conversation.userId here
        // and keep SYSTEM_ACTOR for the read. A foreign/non-existent
        // conversationId collapses to 404 (anti-enumeration) with no side
        // effect run.
        const existing = await conversationModel.findById(conversationId);
        if (!existing || existing.userId !== actor.id) {
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

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        // Fetch thread via service. The service updates lastReadAtByGuest and
        // cancels notification schedules for the GUEST side.
        // We pass an empty ownerAccommodationIds array since this is a guest route.
        const cursor = query.cursor ? new Date(query.cursor) : undefined;
        const result = await conversationSvc.getThread(
            SYSTEM_ACTOR,
            {
                conversationId,
                actorSide: 'GUEST',
                cursor,
                limit: query.limit
            },
            [] // Guest route: no owner accommodation IDs needed
        );

        if (result.error) {
            // NOT_FOUND → 404 regardless of cause (anti-enumeration)
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

        const { conversation, messages, hasMore } = result.data;

        // Ownership check: guest must be the conversation owner (anti-enumeration: 404)
        if (conversation.userId !== actor.id) {
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

        // Enrich the conversation with the accommodation's display name + slug
        // and the property owner's display name. The web thread page renders
        // them in the header ("Conversación con {ownerName}", breadcrumb to
        // the accommodation), and surfacing them here keeps that page free
        // of an extra round trip.
        const accommodation = (conversation as { accommodationId: string }).accommodationId
            ? await accommodationModel.findById(
                  (conversation as { accommodationId: string }).accommodationId
              )
            : null;
        const owner =
            accommodation && (accommodation as { ownerId?: string }).ownerId
                ? await userModel.findById((accommodation as { ownerId: string }).ownerId)
                : null;
        const enrichedConversation = {
            ...conversation,
            accommodationName: (accommodation as { name?: string } | null)?.name ?? null,
            accommodationSlug: (accommodation as { slug?: string } | null)?.slug ?? null,
            ownerName:
                (owner as { displayName?: string } | null)?.displayName ??
                (owner as { firstName?: string } | null)?.firstName ??
                null
        };

        // Build nextCursor from the oldest message's createdAt when there are older pages
        const nextCursor =
            hasMore && messages.length > 0 ? (messages[0]?.createdAt?.toISOString() ?? null) : null;

        return createResponse({ conversation: enrichedConversation, messages, nextCursor }, c, 200);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as threadProtectedConversationRoute };
