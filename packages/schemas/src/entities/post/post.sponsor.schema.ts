import { z } from 'zod';
import {
    ContactInfoSchema,
    MediaSchema,
    SocialNetworkSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';
import { ClientTypeEnumSchema } from '../../enums/index.js';

/**
 * Post Sponsor schema definition using Zod for validation.
 * Represents a sponsor entity for a post.
 */
export const PostSponsorSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        name: z
            .string()
            .min(3, { message: 'zodError.post.sponsor.name.min' })
            .max(100, { message: 'zodError.post.sponsor.name.max' }),
        type: ClientTypeEnumSchema,
        description: z
            .string()
            .min(10, { message: 'zodError.post.sponsor.description.min' })
            .max(500, { message: 'zodError.post.sponsor.description.max' }),
        logo: MediaSchema.optional(),
        contact: ContactInfoSchema.optional(),
        social: SocialNetworkSchema.optional()
    });
