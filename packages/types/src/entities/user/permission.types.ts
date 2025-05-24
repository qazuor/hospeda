import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { PermissionId, RoleId, UserId } from '../../common/id.types.js';

export interface PermissionType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    id: PermissionId;
    name: string;
    description: string;
    isBuiltIn: boolean;
    isDeprecated: boolean;

    userIds?: UserId[];
    roleIds?: RoleId[];
}
