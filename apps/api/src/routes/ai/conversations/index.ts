/**
 * Admin read of the listing AI chat conversations (HOS-2075).
 *
 * Routes (all gated by `AI_CONVERSATION_VIEW_ANY`, SUPER_ADMIN-only; never by role):
 * - GET /      — conversations by listing / day, newest first, paginated
 * - GET /{id}  — one conversation with its turns in chronological order
 *
 * Read-only and anonymous: the asking user is never returned, and the text is
 * redacted at read time (see `ai-conversations-admin.service.ts`).
 *
 * @module routes/ai/conversations
 */

import {
    AiConversationDetailSchema,
    AiConversationListItemSchema,
    AiConversationsAdminQuerySchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { resolveChatDateRange } from '../../../services/ai-chat-date-range.js';
import {
    getConversation,
    listConversations
} from '../../../services/ai-conversations-admin.service.js';
import { createRouter } from '../../../utils/create-app.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory.js';

/** GET / */
const listConversationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List listing AI chat conversations',
    description:
        'Lists, newest first, the listing AI chat conversations of the last 12 months, ' +
        'optionally narrowed by vertical, listing and day range. Anonymous and redacted. ' +
        'Requires AI_CONVERSATION_VIEW_ANY permission.',
    tags: ['AI - Conversations'],
    requiredPermissions: [PermissionEnum.AI_CONVERSATION_VIEW_ANY],
    requestQuery: AiConversationsAdminQuerySchema.shape,
    responseSchema: AiConversationListItemSchema,
    handler: async (_c, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const parsed = AiConversationsAdminQuerySchema.parse(query ?? {});

        const resolved = resolveChatDateRange({ from: parsed.from, to: parsed.to });
        if (!resolved.ok) {
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, resolved.message);
        }

        const { items, total } = await listConversations({
            entityType: parsed.entityType,
            entityId: parsed.entityId,
            range: resolved.range,
            page,
            pageSize
        });
        return { items, pagination: getPaginationResponse(total, { page, pageSize }) };
    }
});

/** GET /{id} */
const getConversationRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Read one listing AI chat conversation',
    description:
        'Returns one conversation with its turns in chronological order. Anonymous and ' +
        'redacted. Answers 404 when the id does not exist. ' +
        'Requires AI_CONVERSATION_VIEW_ANY permission.',
    tags: ['AI - Conversations'],
    requiredPermissions: [PermissionEnum.AI_CONVERSATION_VIEW_ANY],
    requestParams: { id: z.string().uuid() },
    responseSchema: AiConversationDetailSchema,
    handler: async (_c, params) => {
        const id = params.id as string;
        const conversation = await getConversation({ id });
        if (!conversation) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Conversation '${id}' not found`);
        }
        return conversation;
    }
});

const app = createRouter();

app.route('/', listConversationsRoute);
app.route('/', getConversationRoute);

export { app as adminAiConversationsRoutes };
