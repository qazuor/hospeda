import { z } from 'zod';
import { PostCategoryEnumSchema } from '../../enums/post-category.enum.schema';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema';

/**
 * Post Extras Input schema definition using Zod for validation.
 * Represents additional input data for a post.
 */

// Inputs para relaciones (placeholders, reemplazar por schemas reales cuando existan)
export const NewPostSponsorInputSchema = z.object({}); // TODO: reemplazar por PostSponsorSchema.omit({ id: true, ... })
export const UpdatePostSponsorInputSchema = NewPostSponsorInputSchema.partial();

export const NewPostSponsorshipInputSchema = z.object({}); // TODO: reemplazar por PostSponsorshipSchema.omit({ id: true, ... })
export const UpdatePostSponsorshipInputSchema = NewPostSponsorshipInputSchema.partial();

// Input para filtros de búsqueda de posts
export const PostFilterInputSchema = z.object({
    category: PostCategoryEnumSchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    isNews: z.boolean().optional(),
    isFeaturedInWebsite: z.boolean().optional(),
    authorId: z.string().optional(),
    q: z.string().optional() // búsqueda libre
});

// Input para ordenamiento de resultados
export const PostSortInputSchema = z.object({
    sortBy: z.enum(['title', 'createdAt', 'category', 'likes', 'comments', 'shares']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Input para acciones administrativas
export const PostSetFeaturedInputSchema = z.object({
    isFeatured: z.boolean()
});
export const PostChangeVisibilityInputSchema = z.object({
    visibility: VisibilityEnumSchema
});
