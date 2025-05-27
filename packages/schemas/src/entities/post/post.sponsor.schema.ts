import { z } from 'zod';
import { ContactInfoSchema } from '../../common/contact.schema';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { MediaSchema } from '../../common/media.schema';
import { SocialNetworkSchema } from '../../common/social.schema';
import { ClientTypeEnumSchema } from '../../enums/client-type.enum.schema';

/**
 * Post Sponsor schema definition using Zod for validation.
 * Represents a sponsor entity for a post.
 */
export const PostSponsorSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
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
