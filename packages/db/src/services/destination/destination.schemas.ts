import type { DestinationId, DestinationReviewType, DestinationType } from '@repo/types';
import { z } from 'zod';

/**
 * Input type for getById (DestinationService)
 */
export type GetByIdInput = {
    id: DestinationId;
};

/**
 * Output type for getById (DestinationService)
 */
export type GetByIdOutput = {
    destination: DestinationType | null;
};

/**
 * Zod schema for getById input
 */
export const getByIdInputSchema = z.object({
    id: z.string() as unknown as z.ZodType<DestinationId>
});

/**
 * Input type for getBySlug (DestinationService)
 */
export type GetBySlugInput = {
    slug: string;
};

/**
 * Output type for getBySlug (DestinationService)
 */
export type GetBySlugOutput = {
    destination: DestinationType | null;
};

/**
 * Zod schema for getBySlug input
 */
export const getBySlugInputSchema = z.object({
    slug: z.string().min(1)
});

/**
 * Input type for getByName (DestinationService)
 */
export type GetByNameInput = {
    name: string;
};

/**
 * Output type for getByName (DestinationService)
 */
export type GetByNameOutput = {
    destination: DestinationType | null;
};

/**
 * Zod schema for getByName input
 */
export const getByNameInputSchema = z.object({
    name: z.string().min(1)
});

/**
 * Input type for list (DestinationService)
 */
export type ListInput = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?:
        | 'name'
        | 'slug'
        | 'createdAt'
        | 'updatedAt'
        | 'isFeatured'
        | 'reviewsCount'
        | 'averageRating'
        | 'accommodationsCount';
    visibility?: string;
    isFeatured?: boolean;
    lifecycle?: string;
    moderationState?: string;
    deletedAt?: string | null;
};

/**
 * Output type for list (DestinationService)
 */
export type ListOutput = {
    destinations: DestinationType[];
};

/**
 * Zod schema for list input
 */
export const listInputSchema = z.object({
    limit: z.number().int().positive().max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z
        .enum([
            'name',
            'slug',
            'createdAt',
            'updatedAt',
            'isFeatured',
            'reviewsCount',
            'averageRating',
            'accommodationsCount'
        ])
        .optional(),
    visibility: z.string().optional(),
    isFeatured: z.boolean().optional(),
    lifecycle: z.string().optional(),
    moderationState: z.string().optional(),
    deletedAt: z.string().nullable().optional()
});

/**
 * Input schema for create (DestinationService)
 * Omite campos autogenerados y de auditoría.
 */
export const createInputSchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().min(1),
    location: z.any(), // Mejorar con schema si existe
    media: z.any(), // Mejorar con schema si existe
    isFeatured: z.boolean().optional(),
    visibility: z.string().min(1),
    accommodationsCount: z.number().optional(),
    seo: z.any().optional(),
    adminInfo: z.any().optional(),
    reviewsCount: z.number().optional(),
    averageRating: z.number().optional(),
    lifecycle: z.string().optional(),
    moderationState: z.string().optional(),
    tags: z.any().optional(),
    attractions: z.any().optional(),
    reviews: z.any().optional()
});

export type CreateInput = z.infer<typeof createInputSchema>;
export type CreateOutput = { destination: DestinationType };

/**
 * Input schema for update (DestinationService)
 * Allows updating all writable fields (all except id, createdAt, createdById, deletedAt, deletedById).
 *
 * @example
 * const input = { id: 'dest-1', name: 'Updated Name', summary: 'Updated summary' };
 */
export const updateInputSchema = z.object({
    id: z.string().min(1) as unknown as z.ZodType<DestinationId>,
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    location: z.any().optional(),
    media: z.any().optional(),
    isFeatured: z.boolean().optional(),
    visibility: z.string().min(1).optional(),
    accommodationsCount: z.number().optional(),
    seo: z.any().optional(),
    adminInfo: z.any().optional(),
    reviewsCount: z.number().optional(),
    averageRating: z.number().optional(),
    lifecycle: z.string().optional(),
    moderationState: z.string().optional(),
    tags: z.any().optional(),
    attractions: z.any().optional(),
    reviews: z.any().optional()
});

export type UpdateInput = z.infer<typeof updateInputSchema>;
export type UpdateOutput = { destination: DestinationType };

/**
 * Input schema for getReviews (DestinationService)
 * @example
 * const input = { destinationId: 'dest-1', limit: 10, offset: 0 };
 */
export const getReviewsInputSchema = z.object({
    destinationId: z.string().min(1),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['createdAt']).optional()
});

export type GetReviewsInput = z.infer<typeof getReviewsInputSchema>;
export type GetReviewsOutput = { reviews: DestinationReviewType[] };

/**
 * Input schema for search (DestinationService)
 * Filters: text, isFeatured, visibility, lifecycle, moderationState, averageRatingMin, averageRatingMax
 * Order: name, updatedAt, isFeatured, reviewsCount, averageRating, accommodationsCount
 */
export const searchInputSchema = z.object({
    text: z.string().optional(),
    isFeatured: z.boolean().optional(),
    visibility: z.string().optional(),
    lifecycle: z.string().optional(),
    moderationState: z.string().optional(),
    averageRatingMin: z.number().min(0).max(5).optional(),
    averageRatingMax: z.number().min(0).max(5).optional(),
    orderBy: z
        .enum([
            'name',
            'updatedAt',
            'isFeatured',
            'reviewsCount',
            'averageRating',
            'accommodationsCount'
        ])
        .optional(),
    order: z.enum(['asc', 'desc']).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0)
});

export type SearchInput = z.infer<typeof searchInputSchema>;
export type SearchOutput = { destinations: DestinationType[]; total: number };
