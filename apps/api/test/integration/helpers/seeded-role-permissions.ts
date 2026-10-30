import type { PermissionEnum, RoleEnum } from '@repo/schemas';
import { ROLE_PERMISSIONS } from '../../../../../packages/seed/src/required/rolePermissions.seed';

/**
 * The permissions the production seed grants a role. This is the same table
 * `seedRolePermissions` writes to `r_role_permission`, so a mock actor built from
 * it holds exactly what a real account of that role holds. Never hand-list
 * permissions for a role-based test: a hand-built actor drifts from the seed and
 * the test then certifies a user that does not exist.
 *
 * @param input.role - Role to read.
 * @returns The role's seeded permissions.
 */
export function seededPermissionsFor({
    role
}: {
    readonly role: RoleEnum;
}): readonly PermissionEnum[] {
    return ROLE_PERMISSIONS[role];
}
