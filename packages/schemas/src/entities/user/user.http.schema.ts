/**
 * User HTTP Schemas
 *
 * HTTP-compatible schemas for user operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { RoleEnum, RoleEnumSchema } from '../../enums/index.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';

/**
 * User status enumeration for HTTP requests
 */
export const UserStatusHttpSchema = z.enum(['active', 'pending', 'suspended', 'deactivated'], {
    message: 'zodError.user.status.invalid'
});

/**
 * HTTP-compatible user search schema with automatic coercion
 * Handles query string parameters from HTTP requests and converts them to typed objects
 */
export const UserSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    email: z.string().email().optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    clerkId: z.string().min(1).optional(),

    // Enum filters
    role: RoleEnumSchema.optional(),
    status: UserStatusHttpSchema.optional(),

    // Boolean filters with HTTP coercion
    isEmailVerified: createBooleanQueryParam('Filter by email verification status'),
    isActive: createBooleanQueryParam('Filter by user active status'),
    hasAvatar: createBooleanQueryParam('Filter users who have profile avatars'),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    lastLoginAfter: z.coerce.date().optional(),
    lastLoginBefore: z.coerce.date().optional(),

    // Text search filters
    nameContains: z.string().min(1).max(100).optional(),
    emailContains: z.string().min(1).max(100).optional(),
    bioContains: z.string().min(1).max(500).optional(),

    // Array filters with HTTP coercion
    roles: createArrayQueryParam('Filter by multiple user roles'),
    statuses: createArrayQueryParam('Filter by multiple user statuses'),

    // Numeric filters with HTTP coercion
    minAge: z.coerce.number().int().min(0).max(120).optional(),
    maxAge: z.coerce.number().int().min(0).max(120).optional()
});

export type UserSearchHttp = z.infer<typeof UserSearchHttpSchema>;

/**
 * HTTP-compatible user creation schema
 * Handles form data and JSON input for creating users via HTTP
 */
export const UserCreateHttpSchema = z.object({
    email: z.string().email({ message: 'zodError.user.email.invalid' }),
    firstName: z.string().min(1, { message: 'zodError.user.firstName.required' }).max(100),
    lastName: z.string().min(1, { message: 'zodError.user.lastName.required' }).max(100),
    phone: z
        .string()
        .regex(/^\+[1-9]\d{1,14}$/)
        .optional(),
    bio: z.string().max(1000).optional(),
    dateOfBirth: z.coerce.date().max(new Date()).optional(),
    role: RoleEnumSchema.default(RoleEnum.GUEST),
    status: UserStatusHttpSchema.default('pending')
});

export type UserCreateHttp = z.infer<typeof UserCreateHttpSchema>;

/**
 * HTTP-compatible user update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const UserUpdateHttpSchema = UserCreateHttpSchema.partial().extend({
    // ID is required for updates but comes from URL params, not body
    isEmailVerified: z.coerce.boolean().optional(),
    avatar: z.string().url().optional()
});

export type UserUpdateHttp = z.infer<typeof UserUpdateHttpSchema>;

/**
 * HTTP-compatible user query parameters for single user retrieval
 * Used for GET /users/:id type requests
 */
export const UserGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeProfile: createBooleanQueryParam('Include full user profile data'),
    includeSettings: createBooleanQueryParam('Include user settings data'),
    includePermissions: createBooleanQueryParam('Include user permissions data')
});

export type UserGetHttp = z.infer<typeof UserGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { UserCreateInput, UserUpdateInput } from './user.crud.schema.js';
import type { UserSearch } from './user.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters to properly typed domain search fields
 */
export const httpToDomainUserSearch = (httpParams: UserSearchHttp): UserSearch => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,

    // User-specific filters that exist in BOTH HTTP and domain schemas
    role: httpParams.role,
    isActive: httpParams.isActive,
    isEmailVerified: httpParams.isEmailVerified,
    createdAfter: httpParams.createdAfter,
    createdBefore: httpParams.createdBefore,
    lastLoginAfter: httpParams.lastLoginAfter,
    lastLoginBefore: httpParams.lastLoginBefore,
    minAge: httpParams.minAge,
    maxAge: httpParams.maxAge

    // Note: Fields like email, firstName, lastName, etc. exist in HTTP schema
    // but not in domain search schema for privacy/security reasons
});

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields and proper structure
 */
export const httpToDomainUserCreate = (httpData: UserCreateHttp): UserCreateInput => ({
    // Basic fields that exist in domain schema
    firstName: httpData.firstName,
    lastName: httpData.lastName,
    birthDate: httpData.dateOfBirth, // Map dateOfBirth to birthDate
    role: httpData.role,

    // Required fields with defaults for domain schema
    slug: `${httpData.firstName.toLowerCase()}-${httpData.lastName.toLowerCase()}-${Date.now()}`, // Generate slug
    permissions: [], // Default empty permissions array
    lifecycleState: LifecycleStatusEnum.ACTIVE, // Default lifecycle state
    visibility: VisibilityEnum.PUBLIC, // Default visibility

    // Map contact info with required mobilePhone field
    contactInfo: {
        personalEmail: httpData.email,
        mobilePhone: httpData.phone || '+1234567890' // Provide default if phone not provided
    }

    // Note: Many domain fields have defaults or are optional
    // The service layer will handle setting additional fields as needed
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainUserUpdate = (httpData: UserUpdateHttp): UserUpdateInput => ({
    // Basic updateable fields
    firstName: httpData.firstName,
    lastName: httpData.lastName,
    birthDate: httpData.dateOfBirth,
    role: httpData.role

    // Note: Contact info updates are complex due to required mobilePhone field
    // The service layer should handle merging existing contactInfo with new data

    // Note: Complex fields like avatar, settings, etc. may need
    // special handling in the service layer
});
