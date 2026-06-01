import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { PermissionEffectEnum } from '../../enums/permission-effect.enum.js';
import { PermissionEnumSchema } from '../../enums/permission.schema.js';
import { PermissionEffectSchema } from '../permission/permission.management.schema.js';

/**
 * Zod schema for the assignment of a permission to a user.
 * The permission is referenced by its enum.
 *
 * `effect` defaults to `'grant'` (additive override). A `'deny'` effect
 * subtracts a role-granted permission from this user (SPEC-170).
 */
export const UserPermissionAssignmentSchema = z.object({
    userId: UserIdSchema,
    permission: PermissionEnumSchema,
    effect: PermissionEffectSchema.default(PermissionEffectEnum.GRANT)
});

export type UserPermissionAssignment = z.infer<typeof UserPermissionAssignmentSchema>;

// ============================================================================
// ADMIN API SCHEMAS — per-user permission override endpoints (SPEC-170)
// /api/v1/admin/users/:id/permissions
// ============================================================================

/**
 * Response shape for `GET /admin/users/:id/permissions`.
 *
 * Splits the user's effective permission picture into the three buckets the
 * admin panel renders distinctly:
 * - `fromRole`: permissions inherited from the user's role (read-only here).
 * - `grantOverrides`: permissions added directly to the user (`effect = 'grant'`).
 * - `denyOverrides`: role permissions subtracted from the user (`effect = 'deny'`).
 */
export const UserPermissionOverridesResponseSchema = z.object({
    fromRole: z.array(PermissionEnumSchema),
    grantOverrides: z.array(PermissionEnumSchema),
    denyOverrides: z.array(PermissionEnumSchema)
});

export type UserPermissionOverridesResponse = z.infer<typeof UserPermissionOverridesResponseSchema>;

/**
 * Request body for `POST /admin/users/:id/permissions`.
 *
 * Creates or updates (upsert) a per-user override. `effect` is required here
 * (the caller must state intent explicitly when managing overrides via the API),
 * unlike the service-level assignment schema which defaults to `'grant'`.
 */
export const AssignUserPermissionOverrideBodySchema = z
    .object({
        permission: PermissionEnumSchema,
        effect: PermissionEffectSchema
    })
    .strict();

export type AssignUserPermissionOverrideBody = z.infer<
    typeof AssignUserPermissionOverrideBodySchema
>;

/**
 * Path params for `DELETE /admin/users/:id/permissions/:permission`.
 *
 * Removes a per-user override (grant or deny); the user falls back to
 * role-only behavior for that permission.
 */
export const DeleteUserPermissionOverrideParamsSchema = z.object({
    id: UserIdSchema,
    permission: PermissionEnumSchema
});

export type DeleteUserPermissionOverrideParams = z.infer<
    typeof DeleteUserPermissionOverrideParamsSchema
>;
