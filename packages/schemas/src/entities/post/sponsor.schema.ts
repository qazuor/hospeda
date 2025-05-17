// export interface PostSponsorType extends BaseEntityType {

import { z } from 'zod';
import { BaseEntitySchema, ContactInfoSchema, SocialNetworkSchema } from '../../common.schema.js';
import { ClientTypeEnumSchema } from '../../enums.schema.js';
import { PostSponsorshipSchema } from './sponsorship.schema.js';

// }

/**
 * Zod schema for post sponsor entity.
 */
export const PostSponsorSchema = BaseEntitySchema.extend({
    type: ClientTypeEnumSchema,
    description: z
        .string()
        .min(3, 'error:post.sponsor.description.min_lenght')
        .max(100, 'error:post.sponsor.description.max_lenght'),
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    logo: z.string().min(1, 'error:post.sponsor.logo.min_lenght').optional(),
    social: SocialNetworkSchema.optional(),
    contact: ContactInfoSchema.optional(),
    sponsorships: z.array(PostSponsorshipSchema).optional()
});

export type PostSponsorInput = z.infer<typeof PostSponsorSchema>;
