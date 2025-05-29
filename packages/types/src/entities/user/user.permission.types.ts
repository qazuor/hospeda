import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { PermissionId, RoleId, UserId } from '../../common/id.types.js';

export interface PermissionType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: PermissionId;
    name: string;
    description: string;
    isBuiltIn: boolean;
    isDeprecated: boolean;

    userIds?: UserId[];
    roleIds?: RoleId[];
}

export interface UserPermissionType {
    userId: UserId;
    permissionId: PermissionId;
}

export interface RolePermissionType {
    roleId: RoleId;
    permissionId: PermissionId;
}

/**
 * Partial editable structure of a PermissionType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPermissionType = Partial<Writable<PermissionType>>;

/**
 * Input structure used to create a new permission.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPermissionInputType = NewEntityInput<PermissionType>;

/**
 * Input structure used to update an existing permission.
 * All fields are optional for partial patching.
 */
export type UpdatePermissionInputType = PartialPermissionType;
