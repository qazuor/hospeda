import { z } from 'zod';
import { BaseEntitySchema, BaseLocationSchema, MediaSchema, SeoSchema } from '../common.schema';
import { VisibilityEnumSchema } from '../enums.schema';
import { SlugRegex, omittedBaseEntityFieldsForActions } from '../utils/utils';
import { DestinationAttractionsSchema } from './destination/attraction.schema';
import { DestinationRatingSchema } from './destination/rating.schema';
import { DestinationReviewSchema } from './destination/review.schema';

/**
 * Zod schema for a tag entity.
 */
export const DestinationSchema = BaseEntitySchema.extend({
    slug: z
        .string()
        .min(3, 'error:destination.slug.min_lenght')
        .max(30, 'error:destination.slug.max_lenght')
        .regex(SlugRegex, {
            message: 'error:destination.slug.pattern'
        }),
    summary: z
        .string()
        .min(50, 'error:destination.summary.min_lenght')
        .max(200, 'error:destination.summary.max_lenght'),
    description: z
        .string()
        .min(50, 'error:destination.description.min_lenght')
        .max(1000, 'error:destination.description.max_lenght'),
    media: MediaSchema,
    isFeatured: z
        .boolean({
            required_error: 'error:destination.isFeatured.required',
            invalid_type_error: 'error:destination.isFeatured.invalid_type'
        })
        .optional(),
    visibility: VisibilityEnumSchema,
    seo: SeoSchema,
    rating: DestinationRatingSchema,
    reviews: z.array(DestinationReviewSchema).optional(),
    location: BaseLocationSchema,
    attractions: z
        .array(DestinationAttractionsSchema)
        .min(1, 'error:destination.attractions.min_lenght')
        .max(1, 'error:destination.attractions.max_lenght')
});

export type DestinationInput = z.infer<typeof DestinationSchema>;

export const DestinationCreateSchema = DestinationSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof DestinationSchema.shape,
        true
    >
);

export const DestinationUpdateSchema = DestinationSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof DestinationSchema.shape,
        true
    >
).partial();
