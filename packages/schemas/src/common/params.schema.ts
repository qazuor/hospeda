import { z } from 'zod';

/**
 * Common HTTP parameter schemas
 * Reusable schemas for common route parameters
 */

/**
 * Slug parameter schema
 * Used in routes like /posts/slug/{slug}, /accommodations/slug/{slug}
 */
export const SlugParamSchema = z
    .string()
    .min(1)
    .describe('Entity slug for URL-friendly identification');

export type SlugParam = z.infer<typeof SlugParamSchema>;

/**
 * User ID parameter schema with validation
 * Used in routes like /users/{id}
 */
export const UserIdParamSchema = z.string().min(3).describe('User ID');

export type UserIdParam = z.infer<typeof UserIdParamSchema>;

/**
 * Generic ID parameter schema
 * Used in routes for UUID-based entity IDs
 */
export const IdParamSchema = z.string().min(1).describe('Entity ID');

export type IdParam = z.infer<typeof IdParamSchema>;

/**
 * Accommodation slug parameter with validation
 * Used in /accommodations/slug/{slug} routes
 */
export const AccommodationSlugParamSchema = z
    .string()
    .min(1, 'Accommodation slug is required')
    .describe('Accommodation URL slug');

export type AccommodationSlugParam = z.infer<typeof AccommodationSlugParamSchema>;

/**
 * Request parameter object schemas for different entities
 */
export const SlugRequestParamsSchema = z.object({
    slug: SlugParamSchema
});

export const UserIdRequestParamsSchema = z.object({
    id: UserIdParamSchema
});

export const IdRequestParamsSchema = z.object({
    id: IdParamSchema
});

export const AccommodationSlugRequestParamsSchema = z.object({
    slug: AccommodationSlugParamSchema
});

export type SlugRequestParams = z.infer<typeof SlugRequestParamsSchema>;
export type UserIdRequestParams = z.infer<typeof UserIdRequestParamsSchema>;
export type IdRequestParams = z.infer<typeof IdRequestParamsSchema>;
export type AccommodationSlugRequestParams = z.infer<typeof AccommodationSlugRequestParamsSchema>;
