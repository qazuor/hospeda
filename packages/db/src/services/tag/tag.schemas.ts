import { EntityTypeEnumSchema } from '@repo/schemas/enums/entity-type.enum.schema';
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
export const addTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    entityId: z.string().min(1, 'Entity ID is required') as unknown as z.ZodType<
        AccommodationId | DestinationId | UserId | PostId | EventId
    >,
    entityType: EntityTypeEnumSchema
});

/**
 * Output type for addTag.
 * @example
 * const output: AddTagOutput = { entityTag: { tagId, entityId, entityType } };
 */
export type AddTagInput = z.infer<typeof addTagInputSchema>;

export type AddTagOutput = { entityTag: EntityTagType };

/**
 * Input schema for removeTag (same as addTag).
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, entityId: 'acc-1' as AccommodationId, entityType: EntityTypeEnum.ACCOMMODATION };
 */
export const removeTagInputSchema = addTagInputSchema;

/**
 * Output type for removeTag.
 * @example
 * const output: RemoveTagOutput = { removed: true };
 */
export type RemoveTagInput = z.infer<typeof removeTagInputSchema>;
export type RemoveTagOutput = { removed: boolean };

/**
 * Input schema for getAccommodationsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const getAccommodationsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['name', 'createdAt']).optional()
});

/**
 * Output type for getAccommodationsByTag.
 * @example
 * const output: GetAccommodationsByTagOutput = { accommodations: [...] };
 */
export type GetAccommodationsByTagInput = z.infer<typeof getAccommodationsByTagInputSchema>;
export type GetAccommodationsByTagOutput = { accommodations: AccommodationType[] };

/**
 * Input schema for getDestinationsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const getDestinationsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['name', 'createdAt']).optional()
});

/**
 * Output type for getDestinationsByTag.
 * @example
 * const output: GetDestinationsByTagOutput = { destinations: [...] };
 */
export type GetDestinationsByTagInput = z.infer<typeof getDestinationsByTagInputSchema>;
export type GetDestinationsByTagOutput = { destinations: DestinationType[] };

/**
 * Input schema for getEventsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const getEventsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['createdAt', 'summary']).optional()
});

/**
 * Output type for getEventsByTag.
 * @example
 * const output: GetEventsByTagOutput = { events: [...] };
 */
export type GetEventsByTagInput = z.infer<typeof getEventsByTagInputSchema>;
export type GetEventsByTagOutput = { events: EventType[] };

/**
 * Input schema for getPostsByTag.
 *
 * @example
 * const input = { tagId: 'tag-1' as TagId, limit: 10, offset: 0 };
 */
export const getPostsByTagInputSchema = z.object({
    tagId: z.string().min(1, 'Tag ID is required') as unknown as z.ZodType<TagId>,
    limit: z.number().int().min(1).max(100).default(20).optional(),
    offset: z.number().int().min(0).default(0).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Output type for getPostsByTag.
 * @example
 * const output: GetPostsByTagOutput = { posts: [...] };
 */
export type GetPostsByTagInput = z.infer<typeof getPostsByTagInputSchema>;
export type GetPostsByTagOutput = { posts: PostType[] };
