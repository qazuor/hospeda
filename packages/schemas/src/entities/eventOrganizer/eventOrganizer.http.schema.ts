/**
 * Event Organizer HTTP Schemas
 *
 * HTTP-compatible schemas for event organizer operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';

/**
 * HTTP-compatible event organizer search schema with automatic coercion
 * Extends base search with organizer-specific filters
 */
export const EventOrganizerSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search filters
    name: z.string().optional(),
    description: z.string().optional(),

    // Contact filters
    email: z.string().email().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),

    // Boolean filters with HTTP coercion
    hasLogo: createBooleanQueryParam('Filter organizers with logos'),
    hasWebsite: createBooleanQueryParam('Filter organizers with websites'),
    hasPhone: createBooleanQueryParam('Filter organizers with phone numbers'),

    // Social media filters
    hasTwitter: createBooleanQueryParam('Filter organizers with Twitter'),
    hasFacebook: createBooleanQueryParam('Filter organizers with Facebook'),
    hasInstagram: createBooleanQueryParam('Filter organizers with Instagram'),
    hasLinkedIn: createBooleanQueryParam('Filter organizers with LinkedIn'),

    // Array filters
    emails: createArrayQueryParam('Filter by multiple email addresses'),
    names: createArrayQueryParam('Filter by multiple organizer names')
});

export type EventOrganizerSearchHttp = z.infer<typeof EventOrganizerSearchHttpSchema>;

/**
 * HTTP-compatible event organizer creation schema
 * Handles form data and JSON input for creating organizers via HTTP
 */
export const EventOrganizerCreateHttpSchema = z.object({
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(500).optional(),
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

export type EventOrganizerCreateHttp = z.infer<typeof EventOrganizerCreateHttpSchema>;

/**
 * HTTP-compatible event organizer update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const EventOrganizerUpdateHttpSchema = EventOrganizerCreateHttpSchema.partial();

export type EventOrganizerUpdateHttp = z.infer<typeof EventOrganizerUpdateHttpSchema>;

/**
 * HTTP-compatible event organizer query parameters for single organizer retrieval
 * Used for GET /event-organizers/:id type requests
 */
export const EventOrganizerGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeEvents: createBooleanQueryParam('Include organized events'),
    includeStats: createBooleanQueryParam('Include organizer statistics')
});

export type EventOrganizerGetHttp = z.infer<typeof EventOrganizerGetHttpSchema>;
