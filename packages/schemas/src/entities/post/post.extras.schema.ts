import { z } from 'zod';
import { MediaSchema } from '../../common/media.schema';
import { TagSchema } from '../../common/tag.schema';
import { PostCategoryEnumSchema } from '../../enums/post-category.enum.schema';
import { AccommodationSchema } from '../accommodation/accommodation.schema';
import { DestinationSchema } from '../destination/destination.schema';
import { EventSchema } from '../event/event.schema';
import { UserSchema } from '../user/user.schema';
import { PostSponsorshipSchema } from './post.sponsorship.schema';

/**
 * Post Extras schema definition using Zod for validation.
 * Represents additional information for a post.
 */

export const PostSummarySchema = z.object({
    id: z.string(),
    slug: z
        .string()
        .min(3, { message: 'zodError.post.slug.min' })
        .max(50, { message: 'zodError.post.slug.max' }),
    title: z
        .string()
        .min(5, { message: 'zodError.post.title.min' })
        .max(100, { message: 'zodError.post.title.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.post.summary.min' })
        .max(200, { message: 'zodError.post.summary.max' }),
    category: PostCategoryEnumSchema,
    media: MediaSchema.optional(),
    createdAt: z.string()
});

export const PostWithRelationsSchema = z.object({
    id: z.string(),
    slug: z
        .string()
        .min(3, { message: 'zodError.post.slug.min' })
        .max(50, { message: 'zodError.post.slug.max' }),
    title: z
        .string()
        .min(5, { message: 'zodError.post.title.min' })
        .max(100, { message: 'zodError.post.title.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.post.summary.min' })
        .max(200, { message: 'zodError.post.summary.max' }),
    content: z
        .string()
        .min(10, { message: 'zodError.post.content.min' })
        .max(5000, { message: 'zodError.post.content.max' }),
    category: PostCategoryEnumSchema,
    media: MediaSchema.optional(),
    createdAt: z.string(),
    author: UserSchema.optional(),
    sponsorship: PostSponsorshipSchema.optional(),
    relatedDestination: DestinationSchema.optional(),
    relatedAccommodation: AccommodationSchema.optional(),
    relatedEvent: EventSchema.optional(),
    tags: z.array(TagSchema).optional()
});
