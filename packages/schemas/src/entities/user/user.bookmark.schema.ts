import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';
import { EntityTypeEnumSchema } from '../../enums/index.js';

/**
 * User Bookmark schema definition using Zod for validation.
 * Represents a bookmark saved by a user.
 */
export const UserBookmarkSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        entityId: z
            .string({ required_error: 'zodError.user.bookmark.entityId.required' })
            .uuid({ message: 'zodError.user.bookmark.entityId.invalidUuid' }),
        entityType: EntityTypeEnumSchema,
        name: z
            .string()
            .min(3, { message: 'zodError.user.bookmark.name.min' })
            .max(100, { message: 'zodError.user.bookmark.name.max' })
            .optional(),
        description: z
            .string()
            .min(10, { message: 'zodError.user.bookmark.description.min' })
            .max(300, { message: 'zodError.user.bookmark.description.max' })
            .optional()
    });
