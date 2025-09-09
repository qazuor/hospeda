import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { PostSponsorIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseSocialFields } from '../../common/social.schema.js';
import { ClientTypeEnumSchema } from '../../enums/index.js';

/**
 * Post Sponsor Schema - using Base Field Objects
 *
 * This schema represents a sponsor entity for a post.
 * Migrated from legacy WithXXXSchema pattern to use base field objects.
 */
export const PostSponsorSchema = z.object({
    // Base fields
    id: PostSponsorIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Sponsor-specific fields
    name: z
        .string()
        .min(3, { message: 'zodError.post.sponsor.name.min' })
        .max(100, { message: 'zodError.post.sponsor.name.max' }),

    type: ClientTypeEnumSchema,

    description: z
        .string()
        .min(10, { message: 'zodError.post.sponsor.description.min' })
        .max(500, { message: 'zodError.post.sponsor.description.max' }),

    // Logo (using media fields)
    logo: z
        .object({
            url: z.string().url(),
            caption: z.string().optional(),
            description: z.string().optional(),
            moderationState: z.string().optional()
        })
        .optional(),

    // Contact and social (using base objects)
    ...BaseContactFields,
    ...BaseSocialFields
});

/**
 * Type export
 */
export type PostSponsor = z.infer<typeof PostSponsorSchema>;
