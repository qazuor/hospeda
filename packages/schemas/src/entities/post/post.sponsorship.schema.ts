import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { PriceSchema } from '../../common/price.schema';

/**
 * Post Sponsorship schema definition using Zod for validation.
 * Represents sponsorship details for a post.
 */
export const PostSponsorshipSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        sponsorId: z.string(),
        postId: z.string(),
        message: z
            .string()
            .min(5, { message: 'zodError.post.sponsorship.message.min' })
            .max(300, { message: 'zodError.post.sponsorship.message.max' })
            .optional(),
        description: z
            .string()
            .min(10, { message: 'zodError.post.sponsorship.description.min' })
            .max(500, { message: 'zodError.post.sponsorship.description.max' }),
        paid: PriceSchema,
        paidAt: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        isHighlighted: z.boolean().optional()
    });
