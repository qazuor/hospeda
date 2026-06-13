/**
 * GET /api/v1/protected/conversations
 *
 * Returns a paginated inbox for the authenticated guest.
 * Supports optional `archivedByGuest` filter and `page`/`pageSize` pagination.
 */

import { AccommodationModel, MessageModel } from '@repo/db';
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

const accommodationModel = new AccommodationModel();
const messageModel = new MessageModel();

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
                archivedByGuest: query.archivedByGuest,
                accommodationId: query.accommodationId
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

        // Enrich each item with the accommodation name + slug so the UI can
        // render "Hotel X" + a working link without a second round trip.
        // The service intentionally returns raw rows so admin tooling stays
        // cheap; the inbox view is where the human-friendly fields belong.
        // TYPE-WORKAROUND: `listForGuest` returns a generic item type that doesn't
        // surface `accommodationId`; the runtime shape always carries it. Widening
        // through unknown to add the field to the type without losing other keys.
        const itemsRaw = (result.data.items ?? []) as unknown as Array<{
            id: string;
            accommodationId: string;
            [k: string]: unknown;
        }>;
        const accommodationIds = [
            ...new Set(itemsRaw.map((item) => item.accommodationId).filter(Boolean))
        ];
        const accommodationsById = new Map<string, { name?: string; slug?: string }>();
        for (const id of accommodationIds) {
            const row = await accommodationModel.findById(id);
            if (row) {
                accommodationsById.set(id, {
                    name: (row as { name?: string }).name,
                    slug: (row as { slug?: string }).slug
                });
            }
        }

        // Batch-fetch last message previews and per-conversation unread counts for
        // the guest. Both queries are single round-trips regardless of inbox size.
        const conversationIds = itemsRaw.map((item) => item.id);
        const [lastMessagePreviews, unreadCountMap] = await Promise.all([
            messageModel.getLastMessagePreviews(conversationIds),
            messageModel.countUnreadForGuestByConversation(conversationIds)
        ]);

        const items = itemsRaw.map((item) => {
            const acc = accommodationsById.get(item.accommodationId);
            const rawExcerpt = lastMessagePreviews.get(item.id) ?? '';
            return {
                ...item,
                accommodationName: acc?.name ?? null,
                accommodationSlug: acc?.slug ?? null,
                lastMessageExcerpt: rawExcerpt.slice(0, 200) || null,
                unreadCount: unreadCountMap.get(item.id) ?? 0
            };
        });

        return createPaginatedResponse(items as unknown[], pagination, c);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as listProtectedConversationsRoute };
