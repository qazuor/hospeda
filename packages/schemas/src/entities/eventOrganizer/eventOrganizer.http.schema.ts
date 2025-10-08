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

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { EventOrganizerSearchInput } from './eventOrganizer.query.schema.js';

import type {
    EventOrganizerCreateInput,
    EventOrganizerUpdateInput
} from './eventOrganizer.crud.schema.js';

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';

/**
 * Convert HTTP event organizer search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainEventOrganizerSearch = (
    httpParams: EventOrganizerSearchHttp
): EventOrganizerSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Text search filters (only available fields)
        name: httpParams.name,
        // Note: description not available in domain search

        // Contact filters (using specific field names from domain schema)
        personalEmail: httpParams.email, // Map generic email to personalEmail
        workEmail: httpParams.email, // Can also map to workEmail
        mobilePhone: httpParams.phone,
        website: httpParams.website

        // Note: boolean filters like isActive, isVerified not available in search
        // Note: arrays like emails, names may not be available in domain search
    };
};

/**
 * Convert HTTP event organizer create data to domain create input
 * Handles form data conversion to proper domain types
 * Sets default lifecycle state to ACTIVE and handles nested object structure
 */
export const httpToDomainEventOrganizerCreate = (
    httpData: EventOrganizerCreateHttp
): EventOrganizerCreateInput => {
    return {
        name: httpData.name,
        description: httpData.description,
        logo: httpData.logo,
        lifecycleState: LifecycleStatusEnum.ACTIVE,

        // Contact info as nested object (mobilePhone is required in domain)
        contactInfo: {
            personalEmail: httpData.email,
            workEmail: httpData.email,
            mobilePhone: httpData.phone || '', // Default empty string if not provided
            website: httpData.website
        },

        // Social networks as nested object
        socialNetworks: {
            twitter: httpData.twitter,
            facebook: httpData.facebook,
            instagram: httpData.instagram,
            linkedIn: httpData.linkedin // Note: field name is linkedIn (capital I)
        }
    };
};

/**
 * Convert HTTP event organizer update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 */
export const httpToDomainEventOrganizerUpdate = (
    httpData: EventOrganizerUpdateHttp
): EventOrganizerUpdateInput => {
    return {
        name: httpData.name,
        description: httpData.description,
        logo: httpData.logo,

        // Contact info as nested object (only if phone is provided, since it's required)
        contactInfo: httpData.phone
            ? {
                  personalEmail: httpData.email,
                  workEmail: httpData.email,
                  mobilePhone: httpData.phone,
                  website: httpData.website
              }
            : undefined,

        // Social networks as nested object (only if fields are provided)
        socialNetworks:
            httpData.twitter || httpData.facebook || httpData.instagram || httpData.linkedin
                ? {
                      twitter: httpData.twitter,
                      facebook: httpData.facebook,
                      instagram: httpData.instagram,
                      linkedIn: httpData.linkedin // Note: field name is linkedIn (capital I)
                  }
                : undefined
    };
};
