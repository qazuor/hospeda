import type { PostSponsorshipType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema, BasePriceSchema } from '../common.schema';

/**
 * Zod schema for post sponsorship link.
 */
export const PostSponsorshipSchema: z.ZodType<PostSponsorshipType> = BaseEntitySchema.extend({
    sponsorId: z.string().uuid({
        message: 'error:postSponsorship.sponsorIdInvalid'
    }),
    postId: z.string().uuid({
        message: 'error:postSponsorship.postIdInvalid'
    }),
    message: z.string().optional(),
    description: z.string({
        required_error: 'error:postSponsorship.descriptionRequired'
    }),
    paid: BasePriceSchema,
    paidAt: z.coerce.date().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    isHighlighted: z.boolean().optional()
});
