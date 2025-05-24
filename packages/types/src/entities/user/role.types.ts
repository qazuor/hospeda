import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { PermissionId, RoleId, UserId } from '../../common/id.types.js';

export interface RoleType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    id: RoleId;
    name: string;
    description: string;
    isBuiltIn: boolean;
    isDeprecated?: boolean;
    isDefault?: boolean;

    permissionIds?: PermissionId[];
    userIds?: UserId[];
}
