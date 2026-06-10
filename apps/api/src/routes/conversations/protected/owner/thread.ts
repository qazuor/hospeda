/**
 * GET /api/v1/protected/conversations/owner/:id
 *
 * Returns a conversation thread for the authenticated owner.
 * Resolves accommodation IDs and verifies ownership (404 if conversation
 * is not in owner's accommodations).
 * Updates `lastReadAtByOwner` and cancels pending notification schedules.
 */

import { accommodations, getDb } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, ThreadQuerySchema } from '@repo/schemas';
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

const router = createRouter();

/**
 * GET /:id
 * Returns the conversation thread for an owner and updates the owner read receipt.
 * Returns 404 for both non-existent conversations AND conversations not in
 * the owner's accommodations (anti-enumeration pattern).
 */
router.get('/:id', async (c) => {
    try {
        const conversationId = c.req.param('id');
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

        // Parse query params
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

        // Resolve owner accommodation IDs for ownership check
        const db = getDb();
        const accRows = await db
            .select({ id: accommodations.id })
            .from(accommodations)
            .where(eq(accommodations.ownerId, actor.id));
        const ownerAccommodationIds = accRows.map((r) => r.id);

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        // Fetch thread via service with OWNER side.
        //
        // The REAL actor is passed (not a system actor): getThread runs
        // `checkCanViewConversation(actor, conversation, ownerAccommodationIds)`
        // BEFORE its read-receipt + notification-cancel side effects. Passing a
        // system actor with CONVERSATION_VIEW_ALL would bypass that check and let
        // a foreign conversationId mutate state before the route's 404 — a
        // write-IDOR. With the real actor, a non-owner is rejected up front and
        // no side effect runs.
        const cursor = query.cursor ? new Date(query.cursor) : undefined;
        const result = await conversationSvc.getThread(
            actor,
            {
                conversationId,
                actorSide: 'OWNER',
                cursor,
                limit: query.limit
            },
            ownerAccommodationIds
        );

        if (result.error) {
            // Collapse both existence and ownership failures to 404
            // (anti-enumeration). FORBIDDEN here can only come from
            // checkCanViewConversation rejecting a non-owner participant — the
            // route's permission gate already passed above.
            if (
                result.error.code === ServiceErrorCode.NOT_FOUND ||
                result.error.code === ServiceErrorCode.FORBIDDEN
            ) {
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

        // Ownership check: conversation must be in owner's accommodations (anti-enumeration)
        const convAccommodationId = (conversation as { accommodationId: string }).accommodationId;
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

        // Build nextCursor from the oldest message's createdAt when there are older pages
        const nextCursor =
            hasMore && messages.length > 0 ? (messages[0]?.createdAt?.toISOString() ?? null) : null;

        return createResponse({ conversation, messages, nextCursor }, c, 200);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as threadOwnerConversationRoute };
