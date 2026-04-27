/**
 * @module entities/conversation/conversation.admin-search.schema
 *
 * Admin search schema for the conversation feature (SPEC-085).
 *
 * Extends {@link AdminSearchBaseSchema} with conversation-specific filters
 * so that admin list endpoints can filter by status, accommodation, owner,
 * and guest email.
 */

import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { ConversationStatusEnum } from '../../enums/conversation-status.enum.js';

/**
 * Admin search schema for conversations.
 *
 * Inherits all base admin search fields (page, pageSize, search, sort, status,
 * includeDeleted, createdAfter, createdBefore) and adds conversation-specific
 * optional filters.
 *
 * @example
 * ```ts
 * const params = ConversationAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   conversationStatus: ConversationStatusEnum.OPEN,
 *   accommodationId: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'
 * });
 * ```
 */
export const ConversationAdminSearchSchema = AdminSearchBaseSchema.extend({
    /**
     * Filter by conversation lifecycle status.
     * Uses a separate field name (`conversationStatus`) to avoid shadowing the
     * base `status` field which is a `LifecycleStatusEnum` filter.
     */
    conversationStatus: z
        .nativeEnum(ConversationStatusEnum)
        .optional()
        .describe('Filter by conversation lifecycle status'),

    /** Filter by accommodation UUID. */
    accommodationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.conversation.accommodationId.uuid' })
        .optional()
        .describe('Filter by accommodation'),

    /** Filter by owner (host) UUID. */
    ownerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.conversation.ownerId.uuid' })
        .optional()
        .describe('Filter by owner (host)'),

    /** Filter by guest email address. */
    guestEmail: z
        .string()
        .email({ message: 'zodError.admin.search.conversation.guestEmail.email' })
        .optional()
        .describe('Filter by guest email address')
});

/**
 * TypeScript type inferred from {@link ConversationAdminSearchSchema}.
 * Represents the validated admin search parameters for conversations.
 */
export type ConversationAdminSearch = z.infer<typeof ConversationAdminSearchSchema>;
