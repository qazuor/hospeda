/**
 * Per-user permission-override reads (SPEC-170, extended by HOS-374).
 *
 * Extracted verbatim from `permission.service.ts` to keep that file under the
 * 500-line ceiling, following the same split as the sibling
 * `permission.service.permission.ts` / `permission.service.trusted-editor.ts`
 * modules. The only behavioral addition is the derived `isTrustedEditor` flag.
 *
 * @module permission.service.overrides
 */
import type { RRolePermissionModel, RUserPermissionModel, UserModel } from '@repo/db';
import type {
    RolePermissionAssignment,
    UserIdType,
    UserPermissionOverridesResponse
} from '@repo/schemas';
import { isTrustedEditorFromGrants, PermissionEffectEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';
import { getUserRoles } from '../user-role/user-role.service.js';

/** Models the override read needs. */
export interface OverridesReadDeps {
    readonly rolePermissionModel: RRolePermissionModel;
    readonly userPermissionModel: RUserPermissionModel;
    readonly userModel: UserModel;
}

/**
 * Builds the full override picture the admin panel renders for one user:
 * role-inherited permissions, the `grant` and `deny` per-user overrides, and the
 * derived `isTrustedEditor` flag.
 *
 * @param deps - Models to read from.
 * @param userId - Target user.
 * @returns The split override response.
 * @throws {ServiceError} NOT_FOUND when the user does not exist.
 */
export const loadUserPermissionOverrides = async (
    deps: OverridesReadDeps,
    userId: UserIdType
): Promise<UserPermissionOverridesResponse> => {
    // The roles are required to compute `fromRole`; a missing user is a 404.
    const targetUser = await deps.userModel.findById(userId);
    if (!targetUser) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found.');
    }

    const { items } = await deps.userPermissionModel.findAll({ userId });
    const grantOverrides = items
        .filter((row) => row.effect === PermissionEffectEnum.GRANT)
        .map((row) => row.permission);
    const denyOverrides = items
        .filter((row) => row.effect === PermissionEffectEnum.DENY)
        .map((row) => row.permission);

    // HOS-296: `fromRole` is the UNION over every hat the user wears, matching
    // what `actorMiddleware` actually resolves. Reporting one role's permissions
    // would show the admin a set the user does not really have.
    const targetUserRoles = await getUserRoles({ userId });
    const perRoleRows = await Promise.all(
        targetUserRoles.map((role) => deps.rolePermissionModel.findAll({ role }))
    );
    const fromRole = Array.from(
        new Set(
            perRoleRows.flatMap(({ items: roleRows }) =>
                roleRows.map((row: RolePermissionAssignment) => row.permission)
            )
        )
    );

    return {
        fromRole,
        grantOverrides,
        denyOverrides,
        // Derived from TRUSTED_EDITOR_PERMISSIONS — never a restated list.
        isTrustedEditor: isTrustedEditorFromGrants({ grantedPermissions: grantOverrides })
    };
};
