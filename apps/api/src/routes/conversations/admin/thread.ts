/**
 * GET /api/v1/admin/conversations/:id
 *
 * Returns a conversation thread for admin actors.
 * Requires CONVERSATION_VIEW_OWN or CONVERSATION_VIEW_ANY.
 * Actors with VIEW_OWN can only read threads for conversations
 * linked to their own accommodations (enforced at service level via ownerAccommodationIds).
 * Actors with VIEW_ANY bypass the accommodation scope check.
 */

import { AccommodationModel, MessageModel, UserModel, getDb } from '@repo/db';
import { accommodations } from '@repo/db';
import {
    AdminThreadResponseSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    ThreadQuerySchema
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

const accommodationModel = new AccommodationModel();
const messageModel = new MessageModel();
const userModel = new UserModel();

/** System-level actor used for service calls requiring full conversation permissions. */
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
 * GET /:id
 * Returns the full conversation thread for an admin actor.
 * Returns `{ conversation, messages, nextCursor? }`.
 */
router.get('/:id', async (c) => {
    try {
        const conversationId = c.req.param('id');
        const actor = getActorFromContext(c);

        const hasViewOwn = actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN);
        const hasViewAny = actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY);

        if (!hasViewOwn && !hasViewAny) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: conversation view permission required'
                },
                c,
                403
            );
        }

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

        // Resolve ownerAccommodationIds for scope check.
        // VIEW_ANY actors pass an empty array (bypasses scope check in service).
        // VIEW_OWN actors pass their own accommodation IDs.
        let ownerAccommodationIds: string[] = [];

        if (!hasViewAny && hasViewOwn) {
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

        const cursor = query.cursor ? new Date(query.cursor) : undefined;
        const result = await conversationSvc.getThread(
            SYSTEM_ACTOR,
            {
                conversationId,
                actorSide: 'OWNER',
                cursor,
                limit: query.limit
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

        const { conversation, messages, hasMore } = result.data;

        // TYPE-WORKAROUND: getThread returns a generic conversation type that doesn't
        // surface userId/anonymousName/anonymousEmail at the TS level; the runtime
        // shape always carries these columns. Widening through unknown for enrichment.
        const convRaw = conversation as unknown as {
            id: string;
            accommodationId: string;
            userId: string | null;
            anonymousName: string | null;
            anonymousEmail: string | null;
            [k: string]: unknown;
        };

        // Resolve accommodation display name.
        const accRow = await accommodationModel.findById(convRaw.accommodationId);
        const accommodationName = (accRow as { name?: string | null } | null)?.name ?? null;

        // Resolve guest identity: anonymous name from DB column, registered user from
        // user table (single findByIds call — 0 or 1 element).
        const anonName = convRaw.anonymousName ?? null;
        let guestName: string | null = null;
        let guestEmail: string | null = convRaw.anonymousEmail ?? null;

        if (convRaw.userId) {
            const userRows = await userModel.findByIds([convRaw.userId]);
            if (userRows.length > 0) {
                const u = userRows[0] as {
                    displayName?: string | null;
                    firstName?: string | null;
                    lastName?: string | null;
                    email?: string | null;
                };
                guestName =
                    u.displayName?.trim() ||
                    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
                    null;
                // Prefer anonymousEmail (the address used at initiation) then user.email.
                guestEmail = convRaw.anonymousEmail ?? u.email ?? null;
            }
        }

        // Unread count for the owner side on this single conversation.
        const unreadCountByOwner =
            (await messageModel.countUnreadForOwnerByConversation([convRaw.id])).get(convRaw.id) ??
            0;

        // Build olderCursor from messages[0].createdAt when there are older pages.
        // Key is `olderCursor` (NOT `nextCursor`) to match the admin client contract.
        const createdAt = messages[0]?.createdAt;
        const olderCursor =
            hasMore && messages.length > 0
                ? createdAt instanceof Date
                    ? createdAt.toISOString()
                    : ((createdAt as string | undefined) ?? null)
                : null;

        return createResponse(
            {
                conversation: {
                    ...convRaw,
                    guest: { anonName, name: guestName, email: guestEmail },
                    accommodation: { id: convRaw.accommodationId, name: accommodationName },
                    unreadCountByOwner
                },
                messages,
                olderCursor
            },
            c,
            200,
            AdminThreadResponseSchema
        );
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as threadAdminConversationRoute };
