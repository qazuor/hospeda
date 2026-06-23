/**
 * GET /api/v1/admin/conversations
 *
 * Returns a paginated list of conversations for admin actors.
 * - Actors with CONVERSATION_VIEW_ALL receive all conversations (all accommodations).
 * - Actors with only CONVERSATION_VIEW_OWN receive conversations scoped to their
 *   own accommodations (resolved at runtime via AccommodationModel).
 *
 * Scope resolution:
 * - VIEW_ALL → `accommodationIds = []` (service/model handles ALL scope with empty array
 *   treated as "no filter" at DB level). To avoid this ambiguity, we pass a special
 *   sentinel: when VIEW_ALL, we fetch ALL accommodation IDs via a dedicated DB query
 *   so `listForOwner` behaves consistently regardless of actor scope.
 *
 * Design decision: we reuse `ConversationService.listForOwner` for both scopes.
 * - For VIEW_ALL actors: we pass `accommodationIds = ['*']` as a signal is NOT viable
 *   because `listForOwner` validates UUIDs. Instead, for VIEW_ALL we do a separate
 *   `AccommodationModel.findAll()` to get all IDs and pass them. This avoids adding a
 *   new service method and keeps the service interface stable (T-011 decision).
 */

import { AccommodationModel, MessageModel, UserModel, getDb } from '@repo/db';
import { accommodations } from '@repo/db';
import {
    AdminConversationListItemSchema,
    ConversationAdminSearchSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
import { eq, isNull } from 'drizzle-orm';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { calculatePagination } from '../../../utils/pagination';
import {
    createErrorResponse,
    createPaginatedResponse,
    handleRouteError
} from '../../../utils/response-helpers';

const accommodationModel = new AccommodationModel();
const messageModel = new MessageModel();
const userModel = new UserModel();

/** System-level actor used for service calls. */
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
 * GET /
 * Returns a paginated admin list of conversations.
 * Requires CONVERSATION_VIEW_OWN or CONVERSATION_VIEW_ALL.
 */
router.get('/', async (c) => {
    try {
        const actor = getActorFromContext(c);

        // Permission gate: require at least VIEW_OWN
        const hasViewOwn = actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN);
        const hasViewAll = actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ALL);

        if (!hasViewOwn && !hasViewAll) {
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
        const parseResult = ConversationAdminSearchSchema.safeParse(rawQuery);

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

        // Resolve accommodation IDs scope
        let accommodationIds: string[];

        const db = getDb();
        if (hasViewAll) {
            // Fetch all non-deleted accommodation IDs for the ALL scope
            const rows = await db
                .select({ id: accommodations.id })
                .from(accommodations)
                .where(isNull(accommodations.deletedAt));
            accommodationIds = rows.map((r) => r.id);
        } else {
            // Scope to actor's own non-deleted accommodations
            const rows = await db
                .select({ id: accommodations.id })
                .from(accommodations)
                .where(eq(accommodations.ownerId, actor.id));
            accommodationIds = rows.map((r) => r.id);
        }

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.listForOwner(SYSTEM_ACTOR, {
            userId: actor.id,
            accommodationIds,
            page: query.page,
            pageSize: query.pageSize,
            status: query.conversationStatus,
            search: query.guestEmail ?? query.search
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

        const pagination = calculatePagination({
            page: result.data.page,
            pageSize: result.data.pageSize,
            total: result.data.total
        });

        // TYPE-WORKAROUND: listForOwner returns a generic item type that doesn't
        // surface accommodationId/userId/anonymousName at the TS level; the runtime
        // shape always carries these columns. Widening through unknown so we can
        // access them without losing other keys during enrichment.
        const itemsRaw = (result.data.items ?? []) as unknown as Array<{
            id: string;
            accommodationId: string;
            userId: string | null;
            anonymousName: string | null;
            anonymousEmail: string | null;
            [k: string]: unknown;
        }>;

        // Batch-resolve accommodation names (dedup'd, single findById per unique ID).
        const uniqueAccommodationIds = [
            ...new Set(itemsRaw.map((item) => item.accommodationId).filter(Boolean))
        ];
        const accById = new Map<string, { name?: string | null }>();
        for (const id of uniqueAccommodationIds) {
            const row = await accommodationModel.findById(id);
            if (row) {
                accById.set(id, { name: (row as { name?: string | null }).name });
            }
        }

        // Batch-resolve registered user display names and emails (single findByIds call).
        const registeredUserIds = [
            ...new Set(itemsRaw.map((item) => item.userId).filter((id): id is string => !!id))
        ];
        const usersById = new Map<string, { name: string | null; email: string | null }>();
        if (registeredUserIds.length > 0) {
            const userRows = await userModel.findByIds(registeredUserIds);
            for (const u of userRows) {
                const userRow = u as {
                    id: string;
                    displayName?: string | null;
                    firstName?: string | null;
                    lastName?: string | null;
                    email?: string | null;
                };
                const name =
                    userRow.displayName?.trim() ||
                    [userRow.firstName, userRow.lastName].filter(Boolean).join(' ').trim() ||
                    null;
                usersById.set(userRow.id, { name: name || null, email: userRow.email ?? null });
            }
        }

        // Batch-fetch unread counts per conversation for the owner side (single round-trip).
        const conversationIds = itemsRaw.map((item) => item.id);
        const unreadMap =
            conversationIds.length > 0
                ? await messageModel.countUnreadForOwnerByConversation(conversationIds)
                : new Map<string, number>();

        const items = itemsRaw.map((item) => {
            const acc = accById.get(item.accommodationId);
            const userRecord = item.userId ? (usersById.get(item.userId) ?? null) : null;
            return {
                ...item,
                guest: {
                    anonName: item.anonymousName ?? null,
                    name: userRecord?.name ?? null,
                    email: item.anonymousEmail ?? userRecord?.email ?? null
                },
                accommodation: {
                    id: item.accommodationId,
                    name: acc?.name ?? null
                },
                unreadCountByOwner: unreadMap.get(item.id) ?? 0
            };
        });

        return createPaginatedResponse(
            items as unknown[],
            pagination,
            c,
            200,
            AdminConversationListItemSchema
        );
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as listAdminConversationsRoute };
