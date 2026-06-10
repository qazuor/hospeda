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
    /**
     * Optional reference to a user bookmark collection.
     * Null means the bookmark is uncollected (a loose favourite).
     * Undefined is treated equivalently to null on output — both indicate
     * the bookmark has not been assigned to any collection.
     *
     * Additive field (SPEC-098 T-049c): existing consumers that do not
     * read this field are unaffected.
     */
    collectionId: z
        .string({ message: 'zodError.userBookmark.collectionId.invalidUuid' })
        .uuid({ message: 'zodError.userBookmark.collectionId.invalidUuid' })
        .nullable()
        .optional(),
    // Note: min length removed to match UserBookmarkUpdateNotesSchema (request side).
    // Without this, short notes saved via the inline editor pass request validation
    // but fail response validation, leaving a poison pill that breaks subsequent reads.
    name: z.string().max(100, { message: 'zodError.userBookmark.name.max' }).nullish(),
    description: z.string().max(300, { message: 'zodError.userBookmark.description.max' }).nullish()
});

/**
 * Type for UserBookmark, inferred from UserBookmarkSchema
 */
export type UserBookmark = z.infer<typeof UserBookmarkSchema>;
