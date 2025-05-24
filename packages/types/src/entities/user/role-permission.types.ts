import type { PermissionId, RoleId } from '../../common/id.types.js';

export interface RolePermissionType {
    roleId: RoleId;
    permissionId: PermissionId;
}
