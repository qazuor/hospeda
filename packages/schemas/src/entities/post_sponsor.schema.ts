import type { PostSponsorType } from '@repo/types';
import { ClientTypeEnum } from '@repo/types';
import { z } from 'zod';

import {
    BaseEntitySchema,
    ContactInfoSchema,
    ImageSchema,
    SocialNetworkSchema
} from '../common.schema';

/**
 * Zod schema for post sponsor entity.
 */
export const PostSponsorSchema: z.ZodType<PostSponsorType> = BaseEntitySchema.extend({
    type: z.nativeEnum(ClientTypeEnum, {
        required_error: 'error:postSponsor.typeRequired',
        invalid_type_error: 'error:postSponsor.typeInvalid'
    }),
    description: z.string({ required_error: 'error:postSponsor.descriptionRequired' }),
    logo: ImageSchema.optional(),
    social: SocialNetworkSchema.optional(),
    contact: ContactInfoSchema.optional()
});
