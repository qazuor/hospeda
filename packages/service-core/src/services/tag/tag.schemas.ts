import { TagSchema } from '@repo/schemas/entities/tag/tag.schema';
import { TagColorEnumSchema } from '@repo/schemas/enums/tag-color.enum.schema';
import { z } from 'zod';

/**
 * Schema for creating a new tag. Omits server-generated and audit fields.
 */
export const CreateTagSchema = TagSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    lifecycleState: true,
    moderationState: true,
    seo: true
});
export type CreateTagInput = z.infer<typeof CreateTagSchema>;

/**
 * Schema for updating a tag. All fields optional (partial patch).
 */
export const UpdateTagSchema = CreateTagSchema.partial();
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>;

/**
 * Schema for searching/filtering tags.
 */
export const SearchTagSchema = z.object({
    filters: z
        .object({
            name: z.string().optional(),
            color: TagColorEnumSchema.optional(),
            slug: z.string().optional()
        })
        .optional()
});
export type SearchTagInput = z.infer<typeof SearchTagSchema>;
