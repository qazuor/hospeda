import type { UserId } from '../../common/id.types.js';
import type { PermissionEnum } from '../../enums/permission.enum.js';

/**
 * Represents the assignment of a permission to a user.
 * The permission is referenced by its enum.
 */
export interface UserPermissionAssignmentType {
    userId: UserId;
    permission: PermissionEnum;
}
