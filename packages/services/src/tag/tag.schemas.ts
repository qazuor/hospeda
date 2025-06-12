import { EntityTypeEnumSchema } from '@repo/schemas';
import type {
    AccommodationId,
    AccommodationType,
    DestinationId,
    DestinationType,
    EntityTagType,
    EventId,
    EventType,
    PostId,
    PostType,
    TagId,
    UserId
} from '@repo/types';
import { z } from 'zod';

/**
 * Input schema for addTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, entityId: 'acc-1' as AccommodationId, entityType: EntityTypeEnum.ACCOMMODATION };
 */
export const TagAddTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    entityId: z.string().min(1, 'Entity ID is required') as unknown as z.ZodType<
        AccommodationId | DestinationId | UserId | PostId | EventId
    >,
    entityType: EntityTypeEnumSchema
});

/**
 * Output type for addTag.
 * @example
 * const output: TagAddTagOutput = { entityTag: { tagId, entityId, entityType } };
 */
export type TagAddTagInput = z.infer<typeof TagAddTagInputSchema>;

export type TagAddTagOutput = { entityTag: EntityTagType };

/**
 * Input schema for removeTag (same as addTag).
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, entityId: 'acc-1' as AccommodationId, entityType: EntityTypeEnum.ACCOMMODATION };
 */
export const TagRemoveTagInputSchema = TagAddTagInputSchema;

/**
 * Output type for removeTag.
 * @example
 * const output: TagRemoveTagOutput = { removed: true };
 */
export type TagRemoveTagInput = z.infer<typeof TagRemoveTagInputSchema>;
export type TagRemoveTagOutput = { removed: boolean };

/**
 * Input schema for getAccommodationsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const TagGetAccommodationsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['name', 'createdAt']).optional()
});

/**
 * Output type for getAccommodationsByTag.
 * @example
 * const output: TagGetAccommodationsByTagOutput = { accommodations: [...] };
 */
export type TagGetAccommodationsByTagInput = z.infer<typeof TagGetAccommodationsByTagInputSchema>;
export type TagGetAccommodationsByTagOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getDestinationsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const TagGetDestinationsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['name', 'createdAt']).optional()
});

/**
 * Output type for getDestinationsByTag.
 * @example
 * const output: TagGetDestinationsByTagOutput = { destinations: [...] };
 */
export type TagGetDestinationsByTagInput = z.infer<typeof TagGetDestinationsByTagInputSchema>;
export type TagGetDestinationsByTagOutput = { destinations: DestinationType[] };

/**
 * Input schema for getEventsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const TagGetEventsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['createdAt', 'summary']).optional()
});

/**
 * Output type for getEventsByTag.
 * @example
 * const output: TagGetEventsByTagOutput = { events: [...] };
 */
export type TagGetEventsByTagInput = z.infer<typeof TagGetEventsByTagInputSchema>;
export type TagGetEventsByTagOutput = { events: EventType[] };

/**
 * Input schema for getPostsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const TagGetPostsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Output type for getPostsByTag.
 * @example
 * const output: TagGetPostsByTagOutput = { posts: [...] };
 */
export type TagGetPostsByTagInput = z.infer<typeof TagGetPostsByTagInputSchema>;
export type TagGetPostsByTagOutput = { posts: PostType[] };
