import {
    ModerationStatusEnumSchema,
    PostListItemSchema,
    type PostListItemWithRelations,
    PostListItemWithRelationsSchema,
    VisibilityEnumSchema
} from '@repo/schemas';
import { z } from 'zod';

// Re-export the official schema from @repo/schemas for consistency
export { PostListItemSchema, PostListItemWithRelationsSchema };

/**
 * Admin-specific schema with computed fields for handling null relations safely
 * Extends base schema with computed string fields for UI display
 * and admin-only status fields (BUG-005)
 */
export const PostListItemWithComputedFieldsSchema = PostListItemWithRelationsSchema.extend({
    // Admin status fields not included in public list schema
    visibility: VisibilityEnumSchema.optional(),
    moderationState: ModerationStatusEnumSchema.optional(),
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
