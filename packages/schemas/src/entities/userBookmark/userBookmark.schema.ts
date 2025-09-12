import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { UserBookmarkIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { EntityTypeEnumSchema } from '../../enums/index.js';

/**
 * User Bookmark schema definition using Zod for validation.
 * Represents a bookmark saved by a user.
 */
export const UserBookmarkSchema = z.object({
    // Base fields
    id: UserBookmarkIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Bookmark fields
    userId: z
        .string({ message: 'zodError.userBookmark.userId.required' })
        .uuid({ message: 'zodError.userBookmark.userId.invalidUuid' }),
    entityId: z
        .string({ message: 'zodError.userBookmark.entityId.required' })
        .uuid({ message: 'zodError.userBookmark.entityId.invalidUuid' }),
    entityType: EntityTypeEnumSchema,
    name: z
        .string()
        .min(3, { message: 'zodError.userBookmark.name.min' })
        .max(100, { message: 'zodError.userBookmark.name.max' })
        .optional(),
    description: z
        .string()
        .min(10, { message: 'zodError.userBookmark.description.min' })
        .max(300, { message: 'zodError.userBookmark.description.max' })
        .optional()
});

/**
 * Type for UserBookmark, inferred from UserBookmarkSchema
 */
export type UserBookmark = z.infer<typeof UserBookmarkSchema>;
