/**
 * GET /api/v1/protected/conversations/owner
 *
 * Returns a paginated inbox for the authenticated owner.
 * Resolves accommodation IDs via inline DB query (eq(accommodations.ownerId, actor.id))
 * and delegates to ConversationService.listForOwner(). Each item is enriched
 * with accommodationName, guestName, lastMessageExcerpt, and unreadCount before
 * returning so the UI can render inbox rows without additional round trips.
 */

import { AccommodationModel, MessageModel, UserModel, accommodations, getDb } from '@repo/db';
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

const accommodationModel = new AccommodationModel();
const messageModel = new MessageModel();
const userModel = new UserModel();

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

        // TYPE-WORKAROUND: listForOwner returns a generic item type that doesn't
        // surface accommodationId/userId/anonymousName at the TS level; the runtime
        // shape always carries these columns. Widening through unknown so we can
        // access them without losing other keys during enrichment.
        const itemsRaw = (result.data.items ?? []) as unknown as Array<{
            id: string;
            accommodationId: string;
            userId: string | null;
            anonymousName: string | null;
            [k: string]: unknown;
        }>;

        // Batch-resolve accommodation names (dedup'd, single findById per unique ID).
        const uniqueAccommodationIds = [
            ...new Set(itemsRaw.map((item) => item.accommodationId).filter(Boolean))
        ];
        const accommodationsById = new Map<string, { name?: string }>();
        for (const id of uniqueAccommodationIds) {
            const row = await accommodationModel.findById(id);
            if (row) {
                accommodationsById.set(id, { name: (row as { name?: string }).name });
            }
        }

        // Batch-resolve registered user display names (single findByIds call).
        const registeredUserIds = [
            ...new Set(itemsRaw.map((item) => item.userId).filter((id): id is string => !!id))
        ];
        const usersById = new Map<string, string>();
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
                    userRow.email ||
                    null;
                if (name) usersById.set(userRow.id, name);
            }
        }

        // Batch-fetch last message previews and per-conversation unread counts for
        // the owner. Both queries are single round-trips regardless of inbox size.
        const conversationIds = itemsRaw.map((item) => item.id);
        const [lastMessagePreviews, unreadCountMap] = await Promise.all([
            messageModel.getLastMessagePreviews(conversationIds),
            messageModel.countUnreadForOwnerByConversation(conversationIds)
        ]);

        const items = itemsRaw.map((item) => {
            const acc = accommodationsById.get(item.accommodationId);
            const rawExcerpt = lastMessagePreviews.get(item.id) ?? '';
            // Resolve a display name; leave null when neither an anonymous name
            // nor a registered user name is available — the UI applies a
            // localized fallback label (never a hardcoded server-side string).
            const guestName =
                item.anonymousName?.trim() ||
                (item.userId ? (usersById.get(item.userId) ?? null) : null) ||
                null;
            return {
                ...item,
                accommodationName: acc?.name ?? null,
                guestName,
                lastMessageExcerpt: rawExcerpt.slice(0, 200) || null,
                unreadCount: unreadCountMap.get(item.id) ?? 0
            };
        });

        return createPaginatedResponse(items as unknown[], pagination, c);
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as listOwnerConversationsRoute };
