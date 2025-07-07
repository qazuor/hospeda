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

/**
 * Zod schema for removing a tag from an entity (polymorphic).
 * Requires tagId, entityId, and entityType as non-empty strings.
 */
export const RemoveTagFromEntitySchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required'),
    entityId: z.string().min(1, 'Entity ID is required'),
    entityType: z.string().min(1, 'Entity type is required')
});

/**
 * Zod schema for getting all tags for a given entity (polymorphic).
 * Requires entityId and entityType as non-empty strings.
 */
export const GetTagsForEntitySchema = z.object({
    entityId: z.string().min(1, 'Entity ID is required'),
    entityType: z.string().min(1, 'Entity type is required')
});

/**
 * Zod schema for getting all entities associated with a tag.
 * Requires tagId as non-empty string, entityType is optional.
 */
export const GetEntitiesByTagSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required'),
    entityType: z.string().min(1, 'Entity type is required').optional()
});
export type GetEntitiesByTagInput = z.infer<typeof GetEntitiesByTagSchema>;
