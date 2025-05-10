import { z } from 'zod';
import {
    AdminInfoSchema,
    BaseEntitySchema,
    BasePriceSchema,
    ContactInfoSchema,
    ImageSchema,
    SeoSchema,
    SocialNetworkSchema
} from '../common.schema';
import {
    ClientTypeEnumSchema,
    PostCategoryEnumSchema,
    StateEnumSchema,
    VisibilityEnumSchema
} from '../enums.schema';

/**
 * Sponsor information associated with one or multiple posts.
 */
export const PostSponsorSchema = BaseEntitySchema.extend({
    type: ClientTypeEnumSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    logo: ImageSchema.optional(),
    social: SocialNetworkSchema.optional(),
    contact: ContactInfoSchema.optional(),
    tags: z.array(z.string()),
    state: StateEnumSchema,
    adminInfo: AdminInfoSchema.optional()
});

/**
 * Sponsorship metadata for a specific post.
 */
export const PostSponsorshipSchema = BaseEntitySchema.extend({
    sponsor: PostSponsorSchema.optional(),
    message: z.string().optional(),
    description: z.string().min(1),
    tags: z.array(z.string()),
    paid: BasePriceSchema,
    paidAt: z.date().optional(),
    fromDate: z.date().optional(),
    toDate: z.date().optional(),
    isHighlighted: z.boolean().optional(),
    adminInfo: AdminInfoSchema.optional()
});

/**
 * Main schema for a blog post or promotional article.
 */
export const PostSchema = BaseEntitySchema.extend({
    slug: z.string().min(1),
    category: PostCategoryEnumSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    content: z.string().min(1),
    media: z.object({
        featuredImage: ImageSchema,
        gallery: z.array(ImageSchema).optional()
    }),
    tags: z.array(z.string()).optional(),
    authorId: z.string().uuid(),
    isFeatured: z.boolean().optional(),
    visibility: VisibilityEnumSchema,
    seo: SeoSchema.optional(),
    adminInfo: AdminInfoSchema.optional(),
    sponsorship: PostSponsorshipSchema.optional(),
    expiresAt: z.date().optional()
});
