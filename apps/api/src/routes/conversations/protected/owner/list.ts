/**
 * GET /api/v1/protected/conversations/owner
 *
 * Returns a paginated inbox for the authenticated owner.
 * Resolves accommodation IDs via inline DB query (eq(accommodations.ownerId, actor.id))
 * and delegates to ConversationService.listForOwner().
 */

import { accommodations, getDb } from '@repo/db';
import { ConversationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { getActorFromContext } from '../../../../utils/actor';
import { createRouter } from '../../../../utils/create-app';
import { env } from '../../../../utils/env';
import { apiLogger } from '../../../../utils/logger';
import { calculatePagination } from '../../../../utils/pagination';
import {
    createErrorResponse,
    createPaginatedResponse,
    handleRouteError
} from '../../../../utils/response-helpers';
import { SYSTEM_ACTOR } from './system-actor';

const router = createRouter();

/**
 * GET /
 * Returns the authenticated owner's conversation inbox scoped to their accommodations.
 */
router.get('/', async (c) => {
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

        // Parse pagination query params
        const url = new URL(c.req.url);
        const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? '20') || 20)
        );
        const status = url.searchParams.get('status') ?? undefined;
        const search = url.searchParams.get('search') ?? undefined;

        // Validate the optional status filter against the enum so an unknown
        // value fails loudly (400) instead of silently returning an empty list.
        if (
            status !== undefined &&
            !(Object.values(ConversationStatusEnum) as string[]).includes(status)
        ) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Invalid status filter: ${status}`
                },
                c,
                400
            );
        }

        // Resolve accommodation IDs for this owner (inline DB query)
        const db = getDb();
        const rows = await db
            .select({ id: accommodations.id })
            .from(accommodations)
            .where(eq(accommodations.ownerId, actor.id));
        const accommodationIds = rows.map((r) => r.id);

        // Empty accommodations → return empty result immediately
        if (accommodationIds.length === 0) {
            return createPaginatedResponse(
                [],
                calculatePagination({ page, pageSize, total: 0 }),
                c
            );
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
            page,
            pageSize,
            status,
            search
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

        return createPaginatedResponse(result.data.items as unknown[], pagination, c);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as listOwnerConversationsRoute };
