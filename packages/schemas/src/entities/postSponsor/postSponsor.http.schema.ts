/**
 * Post Sponsor HTTP Schemas
 *
 * HTTP-compatible schemas for post sponsor operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { ClientTypeEnumSchema } from '../../enums/index.js';

/**
 * HTTP-compatible post sponsor search schema with automatic coercion
 * Extends base search with sponsor-specific filters
 */
export const PostSponsorSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search filters
    name: z.string().optional(),
    description: z.string().optional(),
    industry: z.string().optional(),

    // Type filters
    type: ClientTypeEnumSchema.optional(),

    // Contact filters
    email: z.string().email().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),

    // Boolean filters with HTTP coercion
    hasLogo: createBooleanQueryParam('Filter sponsors with logos'),
    hasWebsite: createBooleanQueryParam('Filter sponsors with websites'),
    hasDescription: createBooleanQueryParam('Filter sponsors with descriptions'),
    isActive: createBooleanQueryParam('Filter active sponsors'),

    // Social media filters
    hasTwitter: createBooleanQueryParam('Filter sponsors with Twitter'),
    hasFacebook: createBooleanQueryParam('Filter sponsors with Facebook'),
    hasInstagram: createBooleanQueryParam('Filter sponsors with Instagram'),
    hasLinkedIn: createBooleanQueryParam('Filter sponsors with LinkedIn'),

    // Array filters
    types: createArrayQueryParam('Filter by multiple client types'),
    industries: createArrayQueryParam('Filter by multiple industries'),
    names: createArrayQueryParam('Filter by multiple sponsor names')
});

export type PostSponsorSearchHttp = z.infer<typeof PostSponsorSearchHttpSchema>;

/**
 * HTTP-compatible post sponsor creation schema
 * Handles form data and JSON input for creating sponsors via HTTP
 */
export const PostSponsorCreateHttpSchema = z.object({
    name: z.string().min(3).max(100),
    type: ClientTypeEnumSchema,
    description: z.string().min(10).max(500).optional(),
    industry: z.string().max(100).optional(),
    logo: z.string().url().optional(),

    // Contact information
    email: z.string().email().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),

    // Social media links
    twitter: z.string().url().optional(),
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    linkedin: z.string().url().optional()
});

export type PostSponsorCreateHttp = z.infer<typeof PostSponsorCreateHttpSchema>;

/**
 * HTTP-compatible post sponsor update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const PostSponsorUpdateHttpSchema = PostSponsorCreateHttpSchema.partial();

export type PostSponsorUpdateHttp = z.infer<typeof PostSponsorUpdateHttpSchema>;

/**
 * HTTP-compatible post sponsor query parameters for single sponsor retrieval
 * Used for GET /sponsors/:id type requests
 */
export const PostSponsorGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includePosts: createBooleanQueryParam('Include sponsored posts'),
    includeStats: createBooleanQueryParam('Include sponsorship statistics'),
    includeSponsorships: createBooleanQueryParam('Include sponsorship details')
});

export type PostSponsorGetHttp = z.infer<typeof PostSponsorGetHttpSchema>;
