import { z } from 'zod';
import { WithActivityStateSchema, WithAdminInfoSchema } from '../../common';
import { FeatureSchema } from './feature.schema';

/**
 * Accommodation Feature schema definition using Zod for validation.
 * Represents a feature associated with an accommodation, including custom host name and comments.
 */
export const AccommodationFeatureSchema = WithActivityStateSchema.merge(WithAdminInfoSchema).extend(
    {
        /** Accommodation ID this feature belongs to */
        accommodationId: z.string({
            required_error: 'zodError.accommodation.feature.accommodationId.required',
            invalid_type_error: 'zodError.accommodation.feature.accommodationId.invalidType'
        }),
        /** Feature ID */
        featureId: z.string({
            required_error: 'zodError.accommodation.feature.featureId.required',
            invalid_type_error: 'zodError.accommodation.feature.featureId.invalidType'
        }),
        /** Custom name for the feature as rewritten by the host, optional */
        hostReWriteName: z
            .string({
                required_error: 'zodError.accommodation.feature.hostReWriteName.required',
                invalid_type_error: 'zodError.accommodation.feature.hostReWriteName.invalidType'
            })
            .min(3, { message: 'zodError.accommodation.feature.hostReWriteName.min' })
            .max(100, { message: 'zodError.accommodation.feature.hostReWriteName.max' })
            .nullable()
            .optional(),
        /** Comments about the feature, optional */
        comments: z
            .string({
                required_error: 'zodError.accommodation.feature.comments.required',
                invalid_type_error: 'zodError.accommodation.feature.comments.invalidType'
            })
            .min(5, { message: 'zodError.accommodation.feature.comments.min' })
            .max(300, { message: 'zodError.accommodation.feature.comments.max' })
            .nullable()
            .optional(),
        /** Feature object, optional */
        feature: FeatureSchema.optional()
    }
);
