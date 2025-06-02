import type { PermissionEnum } from '../../enums/permission.enum.js';
import type { RoleEnum } from '../../enums/role.enum.js';

/**
 * Represents the assignment of a permission to a role.
 * Both role and permission are referenced by their enums.
 */
export interface RolePermissionAssignmentType {
    role: RoleEnum;
    permission: PermissionEnum;
}
