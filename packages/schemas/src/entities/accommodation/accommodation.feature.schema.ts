import { z } from 'zod';
import { WithAdminInfoSchema } from '../../common/index.js';
import { FeatureSchema } from './feature.schema.js';

/**
 * Accommodation Feature schema definition using Zod for validation.
 * Represents a feature associated with an accommodation, including custom host name and comments.
 */
export const AccommodationFeatureSchema = WithAdminInfoSchema.extend({
    /** Accommodation ID this feature belongs to */
    accommodationId: z.string({
        message: 'zodError.accommodation.feature.accommodationId.required'
    }),
    /** Feature ID */
    featureId: z.string({
        message: 'zodError.accommodation.feature.featureId.required'
    }),
    /** Custom name for the feature as rewritten by the host, optional */
    hostReWriteName: z
        .string({
            message: 'zodError.accommodation.feature.hostReWriteName.required'
        })
        .min(3, { message: 'zodError.accommodation.feature.hostReWriteName.min' })
        .max(100, { message: 'zodError.accommodation.feature.hostReWriteName.max' })
        .nullable()
        .optional(),
    /** Comments about the feature, optional */
    comments: z
        .string({
            message: 'zodError.accommodation.feature.comments.required'
        })
        .min(5, { message: 'zodError.accommodation.feature.comments.min' })
        .max(300, { message: 'zodError.accommodation.feature.comments.max' })
        .nullable()
        .optional(),
    /** Feature object, optional */
    feature: FeatureSchema.optional()
});
