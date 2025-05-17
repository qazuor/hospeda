import { z } from 'zod';
import { BaseEntitySchema } from '../common.schema.js';

/**
 * Zod schema for a feature entity.
 */
export const FeatureSchema = BaseEntitySchema.extend({
    description: z
        .string()
        .min(10, 'error:feature.description.min_lenght')
        .max(150, 'error:feature.description.max_lenght')
        .optional(),
    icon: z.string().min(1, 'error:feature.icon.min_lenght').optional(),
    isBuiltin: z.boolean({
        required_error: 'error:feature.isBuiltin.required',
        invalid_type_error: 'error:feature.isBuiltin.invalid_type'
    })
});

export type FeatureInput = z.infer<typeof FeatureSchema>;

/**
 * Zod schema for the relationship between accommodation and feature.
 */
export const AccommodationFeatureSchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_feature.accommodationId.invalid' }),
    featureId: z.string().uuid({ message: 'error:accommodation_feature.featureId.invalid' }),
    hostReWriteName: z.string().nullable().optional(),
    comments: z.string().nullable().optional(),
    state: z.string().optional(),
    adminInfo: z
        .object({
            notes: z.string().optional(),
            favorite: z.boolean()
        })
        .optional()
});

export type AccommodationFeatureInput = z.infer<typeof AccommodationFeatureSchema>;
