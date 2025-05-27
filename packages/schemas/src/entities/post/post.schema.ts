import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { PostExtrasSchema } from './post.extras.schema';
import { PostSponsorSchema } from './post.sponsor.schema';
import { PostSponsorshipSchema } from './post.sponsorship.schema';

/**
 * Post schema definition using Zod for validation.
 * Includes sponsorship, sponsor, and extras as optional fields.
 */
export const PostSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        /** Post title, 3-150 characters */
        title: z
            .string()
            .min(3, { message: 'zodError.post.title.min' })
            .max(150, { message: 'zodError.post.title.max' }),
        /** Post content, 10-5000 characters */
        content: z
            .string()
            .min(10, { message: 'zodError.post.content.min' })
            .max(5000, { message: 'zodError.post.content.max' }),
        /** Author user ID */
        authorId: z.string(),
        /** Post category, 3-50 characters */
        category: z
            .string()
            .min(3, { message: 'zodError.post.category.min' })
            .max(50, { message: 'zodError.post.category.max' }),
        /** Sponsorship details, optional */
        sponsorship: PostSponsorshipSchema.optional(),
        /** Sponsor details, optional */
        sponsor: PostSponsorSchema.optional(),
        /** Additional post extras, optional */
        extras: PostExtrasSchema.optional()
    });
