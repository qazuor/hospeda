import { z } from 'zod';
import { TagsArraySchema } from '../../common/tag.schema';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema';
import { DestinationAttractionSchema } from './destination.attraction.schema';
import { DestinationReviewSchema } from './destination.review.schema';

/**
 * Destination Extras Input schema definition using Zod for validation.
 * Represents additional input data for a destination.
 */

// Input para crear/editar una atracción de destino
export const NewDestinationAttractionInputSchema = DestinationAttractionSchema.omit({
    destinationId: true // Se puede agregar por backend o en endpoint específico
});
export const UpdateDestinationAttractionInputSchema = NewDestinationAttractionInputSchema.partial();

// Input para crear/editar una review de destino
export const NewDestinationReviewInputSchema = DestinationReviewSchema.omit({
    userId: true, // Se puede agregar por backend o en endpoint específico
    destinationId: true
});
export const UpdateDestinationReviewInputSchema = NewDestinationReviewInputSchema.partial();

// Input para filtros de búsqueda de destinos
export const DestinationFilterInputSchema = z.object({
    state: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    tags: TagsArraySchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    q: z.string().optional() // búsqueda libre
});

// Input para ordenamiento de resultados
export const DestinationSortInputSchema = z.object({
    sortBy: z
        .enum(['name', 'createdAt', 'averageRating', 'reviewsCount', 'accommodationsCount'])
        .optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Input para acciones administrativas
export const DestinationSetFeaturedInputSchema = z.object({
    isFeatured: z.boolean()
});
export const DestinationChangeVisibilityInputSchema = z.object({
    visibility: VisibilityEnumSchema
});
