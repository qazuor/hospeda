import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { PermissionId, RoleId, UserId, UserRoleId } from '../../common/id.types.js';

export interface RoleType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: RoleId;
    name: string;
    description: string;
    isBuiltIn: boolean;
    isDeprecated?: boolean;
    isDefault?: boolean;

    permissionIds?: PermissionId[];
    userIds?: UserId[];
}

export interface UserRoleType extends WithAudit {
    id: UserRoleId;
    userId: UserId;
    roleId: RoleId;
}

/**
 * Partial editable structure of a RoleType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialRoleType = Partial<Writable<RoleType>>;

/**
 * Input structure used to create a new role.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewRoleInputType = NewEntityInput<RoleType>;

/**
 * Input structure used to update an existing role.
 * All fields are optional for partial patching.
 */
export type UpdateRoleInputType = PartialRoleType;
