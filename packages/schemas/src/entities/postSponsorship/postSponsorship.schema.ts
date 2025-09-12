import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    PostIdSchema,
    PostSponsorIdSchema,
    PostSponsorshipIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * Post Sponsorship Schema - using Base Field Objects
 *
 * This schema represents sponsorship details for a post.
 * Migrated from legacy WithXXXSchema pattern to use base field objects.
 */
export const PostSponsorshipSchema = z.object({
    // Base fields
    id: PostSponsorshipIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Sponsorship-specific fields
    sponsorId: PostSponsorIdSchema,
    postId: PostIdSchema,

    message: z
        .string()
        .min(5, { message: 'zodError.post.sponsorship.message.min' })
        .max(300, { message: 'zodError.post.sponsorship.message.max' })
        .optional(),

    description: z
        .string()
        .min(10, { message: 'zodError.post.sponsorship.description.min' })
        .max(500, { message: 'zodError.post.sponsorship.description.max' }),

    // Price information (using direct fields instead of PriceSchema)
    paid: z.object({
        price: z.number().positive({
            message: 'zodError.post.sponsorship.paid.price.positive'
        }),
        currency: PriceCurrencyEnumSchema
    }),

    paidAt: z.date().optional(),
    fromDate: z.date().optional(),
    toDate: z.date().optional(),
    isHighlighted: z.boolean().default(false)
});

/**
 * Type export
 */
export type PostSponsorship = z.infer<typeof PostSponsorshipSchema>;
