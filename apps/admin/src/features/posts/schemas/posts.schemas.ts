import {
    PostListItemSchema,
    type PostListItemWithRelations,
    PostListItemWithRelationsSchema
} from '@repo/schemas';
import { z } from 'zod';

// Re-export the official schema from @repo/schemas for consistency
export { PostListItemSchema, PostListItemWithRelationsSchema };

/**
 * Admin-specific schema with computed fields for handling null relations safely
 * Extends base schema with computed string fields for UI display
 */
export const PostListItemWithComputedFieldsSchema = PostListItemWithRelationsSchema.extend({
    authorName: z.string().optional(),
    accommodationName: z.string().optional(),
    destinationName: z.string().optional(),
    eventName: z.string().optional(),
    sponsorshipInfo: z.string().optional(),
    sponsorName: z.string().optional()
}).transform((data) => ({
    ...data,
    authorName: data.author
        ? data.author.displayName ||
          `${data.author.firstName || ''} ${data.author.lastName || ''}`.trim() ||
          data.author.email ||
          'Usuario sin nombre'
        : 'Sin autor',
    accommodationName: data.relatedAccommodation?.name || undefined,
    destinationName: data.relatedDestination?.name || undefined,
    eventName: data.relatedEvent?.name || undefined,
    sponsorshipInfo: data.sponsorship?.message || undefined,
    sponsorName: data.sponsorship?.sponsor?.name || undefined
}));

export type Post = z.infer<typeof PostListItemWithComputedFieldsSchema>;
export type PostWithRelations = PostListItemWithRelations;
