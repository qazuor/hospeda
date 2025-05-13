import { z } from 'zod';
import { BaseEntitySchema } from '../common.schema';
import { EntityTypeEnumSchema } from '../enums.schema';
import { omittedBaseEntityFieldsForActions } from '../utils/utils';

/**
 * Zod schema for user bookmarks.
 */
export const BookmarkSchema = BaseEntitySchema.extend({
    ownerId: z.string().uuid({ message: 'error:user.bookmark.userId.invalid' }),
    entityId: z.string().uuid({ message: 'error:user.bookmark.entityId.invalid' }),
    entityType: EntityTypeEnumSchema,
    name: z
        .string()
        .min(3, { message: 'error:user.bookmark.name.min_lenght' })
        .max(15, { message: 'error:user.bookmark.name.max_lenght' })
        .optional(),
    description: z
        .string()
        .min(10, { message: 'error:user.bookmark.description.min_lenght' })
        .max(100, { message: 'error:user.bookmark.description.max_lenght' })
        .optional()
});

export type BookmarkInput = z.infer<typeof BookmarkSchema>;

export const BookmarkCreateSchema = BookmarkSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof BookmarkSchema.shape,
        true
    >
);

export const BookmarkUpdateSchema = BookmarkSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof BookmarkSchema.shape,
        true
    >
).partial();
