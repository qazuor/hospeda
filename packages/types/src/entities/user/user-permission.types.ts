import type { PermissionId, UserId } from '../../common/id.types.js';

export interface UserPermissionType {
    userId: UserId;
    permissionId: PermissionId;
}
