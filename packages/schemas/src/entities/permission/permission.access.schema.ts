import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { PermissionEnumSchema } from '../../enums/permission.schema.js';
import { RoleEnumSchema } from '../../enums/role.schema.js';

// ============================================================================
// PERMISSION ACCESS SCHEMAS
// ============================================================================
//
// Permission is an operational (non-entity) domain: there is no single base
// "Permission" table row with user-facing columns to pick from. Instead,
// the domain is composed of enum values (PermissionEnum, RoleEnum) and
// assignment join records.
//
// The three tiers are therefore defined as explicit object schemas rather
// than .pick() derivations of a single base schema.
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — Permission
 *
 * Contains only the permission enum value.
 * Unauthenticated callers have no reason to inspect permissions; this tier
 * exists for completeness and for hypothetical public capability-discovery
 * endpoints (e.g., listing which permissions a public resource requires).
 */
export const PermissionPublicSchema = z.object({
    /** The permission identifier as defined in PermissionEnum */
    permission: PermissionEnumSchema
});

export type PermissionPublic = z.infer<typeof PermissionPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — Permission
 *
 * Same surface area as the public tier. Authenticated users can query their
 * own permissions but do not need to see assignment metadata or other users.
 *
 * Mirrors the public schema; a distinct type is provided so callers can
 * evolve both tiers independently in the future.
 */
export const PermissionProtectedSchema = z.object({
    /** The permission identifier as defined in PermissionEnum */
    permission: PermissionEnumSchema
});

export type PermissionProtected = z.infer<typeof PermissionProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — Permission
 *
 * Full management surface for admin operations.
 * Includes all assignment data: which role or user holds a permission.
 * Used for the admin permission management dashboard.
 */
export const PermissionAdminSchema = z.object({
    /** The permission identifier as defined in PermissionEnum */
    permission: PermissionEnumSchema,

    /** Optional role this permission is assigned to */
    role: RoleEnumSchema.optional(),

    /** Optional user ID this permission is directly assigned to */
    userId: UserIdSchema.optional()
});

export type PermissionAdmin = z.infer<typeof PermissionAdminSchema>;

// ============================================================================
// ROLE ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — Role
 *
 * Exposes only the role enum value.
 * Safe for unauthenticated consumers that need to display role labels.
 */
export const RolePublicSchema = z.object({
    /** The role identifier as defined in RoleEnum */
    role: RoleEnumSchema
});

export type RolePublic = z.infer<typeof RolePublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — Role
 *
 * Same as public tier. Distinct type preserved for future extensibility.
 */
export const RoleProtectedSchema = z.object({
    /** The role identifier as defined in RoleEnum */
    role: RoleEnumSchema
});

export type RoleProtected = z.infer<typeof RoleProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — Role
 *
 * Full role view including its assigned permissions.
 * Used for the admin role management dashboard.
 */
export const RoleAdminSchema = z.object({
    /** The role identifier as defined in RoleEnum */
    role: RoleEnumSchema,

    /** All permissions assigned to this role */
    permissions: z.array(PermissionEnumSchema)
});

export type RoleAdmin = z.infer<typeof RoleAdminSchema>;
