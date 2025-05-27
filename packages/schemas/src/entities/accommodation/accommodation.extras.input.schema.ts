import { z } from 'zod';
import { WithTagsSchema } from '../../common/helpers.schema';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema';
import { AccommodationAmenitySchema } from './accommodation.amenity.schema';
import { AccommodationFeatureSchema } from './accommodation.feature.schema';
import { AccommodationReviewSchema } from './accommodation.review.schema';

// Input para crear/editar una review de alojamiento
export const NewAccommodationReviewInputSchema = AccommodationReviewSchema.omit({
    userId: true,
    accommodationId: true
});
export const UpdateAccommodationReviewInputSchema = NewAccommodationReviewInputSchema.partial();

// Input para crear/editar un amenity de alojamiento
export const NewAccommodationAmenityInputSchema = AccommodationAmenitySchema.omit({
    accommodationId: true,
    amenityId: true
});
export const UpdateAccommodationAmenityInputSchema = NewAccommodationAmenityInputSchema.partial();

// Input para crear/editar un feature de alojamiento
export const NewAccommodationFeatureInputSchema = AccommodationFeatureSchema.omit({
    accommodationId: true,
    featureId: true
});
export const UpdateAccommodationFeatureInputSchema = NewAccommodationFeatureInputSchema.partial();

// Input para filtros de búsqueda de alojamientos
export const AccommodationFilterInputSchema = z.object({
    city: z.string().optional(),
    country: z.string().optional(),
    tags: WithTagsSchema.shape.tags.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    q: z.string().optional() // búsqueda libre
});

// Input para ordenamiento de resultados
export const AccommodationSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'averageRating', 'reviewsCount', 'price']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Input para acciones administrativas
export const AccommodationSetFeaturedInputSchema = z.object({
    isFeatured: z.boolean()
});
export const AccommodationChangeVisibilityInputSchema = z.object({
    visibility: VisibilityEnumSchema
});
