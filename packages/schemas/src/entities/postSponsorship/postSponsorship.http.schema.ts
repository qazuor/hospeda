/**
 * Post Sponsorship HTTP Schemas
 *
 * HTTP-compatible schemas for post sponsorship operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * HTTP-compatible post sponsorship search schema with automatic coercion
 * Handles query string parameters from HTTP requests and converts them to typed objects
 */
export const PostSponsorshipSearchHttpSchema = BaseHttpSearchSchema.extend({
    // ID filters with UUID validation
    sponsorId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),

    // Price filters with HTTP coercion
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Date filters with HTTP coercion
    paidAfter: z.coerce.date().optional(),
    paidBefore: z.coerce.date().optional(),
    fromDateAfter: z.coerce.date().optional(),
    fromDateBefore: z.coerce.date().optional(),
    toDateAfter: z.coerce.date().optional(),
    toDateBefore: z.coerce.date().optional(),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Boolean filters with HTTP coercion
    isPaid: createBooleanQueryParam('Filter by payment status'),
    hasMessage: createBooleanQueryParam('Filter sponsorships with messages'),
    isActive: createBooleanQueryParam('Filter active sponsorships'),
    isExpired: createBooleanQueryParam('Filter expired sponsorships')
});

export type PostSponsorshipSearchHttp = z.infer<typeof PostSponsorshipSearchHttpSchema>;

/**
 * HTTP-compatible post sponsorship creation schema
 * Handles form data and JSON input for creating sponsorships via HTTP
 */
export const PostSponsorshipCreateHttpSchema = z.object({
    sponsorId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    postId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    message: z
        .string()
        .min(5, { message: 'zodError.post.sponsorship.message.min' })
        .max(300, { message: 'zodError.post.sponsorship.message.max' })
        .optional(),

    description: z
        .string()
        .min(10, { message: 'zodError.post.sponsorship.description.min' })
        .max(500, { message: 'zodError.post.sponsorship.description.max' }),

    // Price with HTTP coercion
    price: z.coerce.number().positive({ message: 'zodError.post.sponsorship.paid.price.positive' }),
    currency: PriceCurrencyEnumSchema,

    // Date fields with HTTP coercion
    paidAt: z.coerce.date().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional()
});

export type PostSponsorshipCreateHttp = z.infer<typeof PostSponsorshipCreateHttpSchema>;

/**
 * HTTP-compatible post sponsorship update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const PostSponsorshipUpdateHttpSchema = PostSponsorshipCreateHttpSchema.partial().omit({
    sponsorId: true, // Sponsor cannot be changed after creation
    postId: true // Post cannot be changed after creation
});

export type PostSponsorshipUpdateHttp = z.infer<typeof PostSponsorshipUpdateHttpSchema>;

/**
 * HTTP-compatible post sponsorship query parameters for single sponsorship retrieval
 * Used for GET /post-sponsorships/:id type requests
 */
export const PostSponsorshipGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeSponsor: createBooleanQueryParam('Include sponsor information'),
    includePost: createBooleanQueryParam('Include post information')
});

export type PostSponsorshipGetHttp = z.infer<typeof PostSponsorshipGetHttpSchema>;

/**
 * HTTP-compatible schema for getting sponsorships by sponsor
 */
export const SponsorshipsBySponsorHttpSchema = z.object({
    sponsorId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export type SponsorshipsBySponsorHttp = z.infer<typeof SponsorshipsBySponsorHttpSchema>;

/**
 * HTTP-compatible schema for getting sponsorships by post
 */
export const SponsorshipsByPostHttpSchema = z.object({
    postId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export type SponsorshipsByPostHttp = z.infer<typeof SponsorshipsByPostHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import { LifecycleStatusEnum } from '../../enums/index.js';
import type {
    PostSponsorshipCreateInputSchema,
    PostSponsorshipUpdateInputSchema
} from './postSponsorship.crud.schema.js';

/**
 * Convert HTTP search parameters to domain search format
 */
export function httpToDomainPostSponsorshipSearch(
    httpData: PostSponsorshipSearchHttp
): Partial<PostSponsorshipSearchHttp> {
    return {
        ...httpData,
        isPaid: httpData.isPaid,
        isExpired: httpData.isExpired,
        isActive: httpData.isActive
    };
}

/**
 * Convert HTTP post sponsorship creation data to domain format
 */
export function httpToDomainPostSponsorshipCreate(
    httpData: PostSponsorshipCreateHttp
): z.infer<typeof PostSponsorshipCreateInputSchema> {
    return {
        sponsorId: httpData.sponsorId,
        postId: httpData.postId,
        description: httpData.description || '', // Required in domain
        lifecycleState: LifecycleStatusEnum.ACTIVE, // Default state
        paid: {
            price: httpData.price,
            currency: httpData.currency
        },
        message: httpData.message,
        paidAt: httpData.paidAt,
        fromDate: httpData.fromDate,
        toDate: httpData.toDate,
        isHighlighted: false // Default value
    };
}

/**
 * Convert HTTP post sponsorship update data to domain format
 */
export function httpToDomainPostSponsorshipUpdate(
    httpData: PostSponsorshipUpdateHttp
): z.infer<typeof PostSponsorshipUpdateInputSchema> {
    const result: Partial<z.infer<typeof PostSponsorshipUpdateInputSchema>> = {};

    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.message !== undefined) result.message = httpData.message;
    if (httpData.price !== undefined && httpData.currency !== undefined) {
        result.paid = {
            price: httpData.price,
            currency: httpData.currency
        };
    }
    if (httpData.paidAt !== undefined) result.paidAt = httpData.paidAt;
    if (httpData.fromDate !== undefined) result.fromDate = httpData.fromDate;
    if (httpData.toDate !== undefined) result.toDate = httpData.toDate;

    return result;
}
