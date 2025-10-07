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
