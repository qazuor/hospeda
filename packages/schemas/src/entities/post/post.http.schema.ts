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

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';
import type { PostCreateInput, PostUpdateInput } from './post.crud.schema.js';
import type { PostSearchInput } from './post.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters to properly typed domain search fields
 */
export const httpToDomainPostSearch = (httpParams: PostSearchHttp): PostSearchInput => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,

    // Post-specific filters that exist in both HTTP and domain schemas
    status: httpParams.status,
    category: httpParams.category,
    isFeatured: httpParams.isFeatured,
    isPublished: httpParams.isPublished,
    authorId: httpParams.authorId,
    publishedAfter: httpParams.publishedAfter,
    publishedBefore: httpParams.publishedBefore,
    createdAfter: httpParams.createdAfter,
    createdBefore: httpParams.createdBefore,
    hasMedia: httpParams.hasMedia,
    hasFeaturedImage: httpParams.hasFeaturedImage,
    minReadingTime: httpParams.minReadingTime,
    maxReadingTime: httpParams.maxReadingTime,
    destinationId: httpParams.destinationId,
    accommodationId: httpParams.accommodationId,
    eventId: httpParams.eventId,
    isSponsored: httpParams.isSponsored,
    sponsorId: httpParams.sponsorId,
    tags: httpParams.tags
});

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields
 */
export const httpToDomainPostCreate = (httpData: PostCreateHttp): PostCreateInput => ({
    // Basic post fields
    title: httpData.title,
    slug:
        httpData.slug ||
        httpData.title
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
    summary: httpData.summary,
    content: httpData.content,
    category: httpData.category,
    isFeatured: httpData.isFeatured,
    authorId: httpData.authorId,

    // Map isPublished boolean to publishedAt date
    publishedAt: httpData.isPublished ? new Date() : undefined,

    // Map to related entity fields with proper names
    relatedDestinationId: httpData.destinationId,
    relatedAccommodationId: httpData.accommodationId,
    relatedEventId: httpData.eventId,

    // Reading time with default if not provided
    readingTimeMinutes: httpData.readingTimeMinutes ?? 5,

    // Required fields with defaults for domain schema
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING,

    // Additional required fields with defaults
    isFeaturedInWebsite: false,
    isNews: false,
    likes: 0,
    comments: 0,
    shares: 0
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainPostUpdate = (httpData: PostUpdateHttp): PostUpdateInput => ({
    // Map all updateable fields from HTTP to domain
    title: httpData.title,
    slug: httpData.slug,
    summary: httpData.summary,
    content: httpData.content,
    category: httpData.category,
    isFeatured: httpData.isFeatured,
    authorId: httpData.authorId,

    // Map isPublished to publishedAt (only set if explicitly being published)
    ...(httpData.isPublished !== undefined && {
        publishedAt: httpData.isPublished ? new Date() : undefined
    }),

    // Map to related entity fields
    relatedDestinationId: httpData.destinationId,
    relatedAccommodationId: httpData.accommodationId,
    relatedEventId: httpData.eventId,
    readingTimeMinutes: httpData.readingTimeMinutes

    // Note: Lifecycle, visibility, and moderation states typically
    // should not be updated via simple HTTP requests for security
});
