/**
 * Post HTTP Schemas
 *
 * HTTP-compatible schemas for post operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { LifecycleStatusEnumSchema, PostCategoryEnumSchema } from '../../enums/index.js';

/**
 * HTTP-compatible post search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const PostSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    status: LifecycleStatusEnumSchema.optional(),
    category: PostCategoryEnumSchema.optional(),
    isFeatured: createBooleanQueryParam('Filter featured posts'),
    isPublished: createBooleanQueryParam('Filter published posts'),

    // Author filters with HTTP coercion
    authorId: z.string().uuid().optional(),

    // Date range filters with HTTP coercion
    publishedAfter: z.coerce.date().optional(),
    publishedBefore: z.coerce.date().optional(),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Content filters with HTTP coercion
    hasMedia: createBooleanQueryParam('Filter posts with media'),
    hasFeaturedImage: createBooleanQueryParam('Filter posts with featured images'),

    // Reading time filters with HTTP coercion
    minReadingTime: z.coerce.number().int().min(1).optional(),
    maxReadingTime: z.coerce.number().int().min(1).optional(),

    // Related entities with HTTP coercion
    destinationId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),

    // Sponsorship filters with HTTP coercion
    isSponsored: createBooleanQueryParam('Filter sponsored posts'),
    sponsorId: z.string().uuid().optional(),

    // Array filters with HTTP coercion
    tags: createArrayQueryParam('Filter by tag UUIDs')
});

export type PostSearchHttp = z.infer<typeof PostSearchHttpSchema>;

/**
 * HTTP-compatible post creation schema
 * Handles form data and JSON input for creating posts via HTTP
 */
export const PostCreateHttpSchema = z.object({
    title: z.string().min(5).max(200),
    slug: z
        .string()
        .min(5)
        .max(200)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    summary: z.string().min(10).max(500),
    content: z.string().min(100).max(10000),
    category: PostCategoryEnumSchema,
    isFeatured: z.coerce.boolean().default(false),
    isPublished: z.coerce.boolean().default(false),
    authorId: z.string().uuid(),
    destinationId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    readingTimeMinutes: z.coerce.number().int().min(1).optional()
});

export type PostCreateHttp = z.infer<typeof PostCreateHttpSchema>;

/**
 * HTTP-compatible post update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const PostUpdateHttpSchema = PostCreateHttpSchema.partial();

export type PostUpdateHttp = z.infer<typeof PostUpdateHttpSchema>;
