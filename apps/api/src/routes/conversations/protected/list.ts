/**
 * GET /api/v1/protected/conversations
 *
 * Returns a paginated inbox for the authenticated guest.
 * Supports optional `archivedByGuest` filter and `page`/`pageSize` pagination.
 */

import { GuestInboxQuerySchema } from '@repo/schemas';
import { ConversationService } from '@repo/service-core';
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

const router = createRouter();

/**
 * GET /
 * Returns the authenticated guest's conversation inbox.
 */
router.get('/', async (c) => {
    try {
        const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries());
        const parseResult = GuestInboxQuerySchema.safeParse(rawQuery);

        if (!parseResult.success) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
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

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationSvc.listForGuest(
            { id: actor.id, role: actor.role, permissions: actor.permissions },
            {
                userId: actor.id,
                page: query.page,
                pageSize: query.pageSize,
                archivedByGuest: query.archivedByGuest
            }
        );

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

export { router as listProtectedConversationsRoute };
