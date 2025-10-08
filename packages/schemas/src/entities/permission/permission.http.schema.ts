/**
 * Permission HTTP Schemas
 *
 * HTTP-compatible schemas for permission operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 *
 * Note: Permission entity is primarily for internal management and doesn't have
 * public search endpoints, but we include HTTP schemas for completeness and
 * potential future admin/management interfaces.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';

/**
 * HTTP-compatible permission search schema with automatic coercion
 * Used for potential admin interfaces that might need to search/filter permissions
 */
export const PermissionSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Permission-specific filters with HTTP coercion
    role: z.string().optional(),
    permission: z.string().optional(),

    // Array filters for multiple values
    roles: createArrayQueryParam('Filter by multiple roles'),
    permissions: createArrayQueryParam('Filter by multiple permissions'),

    // Boolean filters with HTTP coercion
    isActive: createBooleanQueryParam('Filter by active status'),
    isSystem: createBooleanQueryParam('Filter by system permissions')
});

export type PermissionSearchHttp = z.infer<typeof PermissionSearchHttpSchema>;

/**
 * HTTP-compatible role assignment schema
 * Used for assigning permissions to roles via HTTP API
 */
export const RolePermissionAssignmentHttpSchema = z.object({
    roleId: z.string().describe('Role identifier'),
    permissionId: z.string().describe('Permission identifier'),
    action: z.enum(['assign', 'remove']).describe('Assignment action')
});

export type RolePermissionAssignmentHttp = z.infer<typeof RolePermissionAssignmentHttpSchema>;

/**
 * HTTP-compatible user role assignment schema
 * Used for assigning roles to users via HTTP API
 */
export const UserRoleAssignmentHttpSchema = z.object({
    userId: z.string().describe('User identifier'),
    roleId: z.string().describe('Role identifier'),
    action: z.enum(['assign', 'remove']).describe('Assignment action')
});

export type UserRoleAssignmentHttp = z.infer<typeof UserRoleAssignmentHttpSchema>;

/**
 * Conversion function: HTTP query parameters to domain search parameters
 * Handles the transformation from HTTP strings to typed domain objects
 */
export const httpToDomainPermissionSearch = (
    httpParams: PermissionSearchHttp
): PermissionSearchHttp => {
    return {
        ...httpParams
        // HTTP coercion is handled by the schema, no additional transformation needed
        // for this simple case, but this function maintains consistency with other entities
    };
};
