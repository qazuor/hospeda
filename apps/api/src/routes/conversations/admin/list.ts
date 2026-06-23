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

import { getDb } from '@repo/db';
import { accommodations } from '@repo/db';
import {
    ConversationAdminSearchSchema,
    ConversationSchema,
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

        return createPaginatedResponse(
            result.data.items as unknown[],
            pagination,
            c,
            200,
            ConversationSchema
        );
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as listAdminConversationsRoute };
