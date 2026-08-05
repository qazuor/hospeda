/**
 * Per-user permission-override reads (SPEC-170, extended by HOS-374).
 *
 * Extracted from `permission.service.ts` to keep that file under the 500-line
 * ceiling, following the same split as the sibling
 * `permission.service.permission.ts` / `permission.service.trusted-editor.ts`
 * modules.
 *
 * Two behavioral changes came with the extraction, both from HOS-374: the
 * derived `isTrustedEditor` flag, and reading ALL override pages instead of the
 * single default-sized page the original read (see {@link OVERRIDES_PAGE_SIZE}
 * — the truncation was latent before the flag started depending on it).
 *
 * @module permission.service.overrides
 */
import type { RRolePermissionModel, RUserPermissionModel, UserModel } from '@repo/db';
import type {
    RolePermissionAssignment,
    UserIdType,
    UserPermissionOverridesResponse
} from '@repo/schemas';
import {
    isTrustedEditorFromGrants,
    PermissionEffectEnum,
    type PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '../../types';
import { getUserRoles } from '../user-role/user-role.service.js';

/**
 * Page size used to read a user's overrides.
 *
 * `BaseModelImpl.findAll` ALWAYS paginates and defaults to 20 rows when no
 * `pageSize` is given — it does not return everything. `PermissionEnum` has
 * ~750 values, so a user can hold far more than 20 overrides, and reading
 * without an explicit size silently drops the rest. That was survivable while
 * this only fed a display list; it stopped being survivable once
 * `isTrustedEditor` started being DERIVED from the result, because a truncated
 * page turns a trusted editor into a false `false` and the admin toggle then
 * shows the opposite of the truth.
 *
 * 200 is `BaseModelImpl`'s own `MAX_PAGE_SIZE` (module-private, so restated
 * here); anything larger is capped to it. {@link readAllOverrideRows} pages
 * past it rather than trusting one request to be enough.
 */
const OVERRIDES_PAGE_SIZE = 200;

/**
 * Hard bound on pages read, so a model that keeps returning full pages can
 * never spin forever. `PermissionEnum` has ~750 values and a user cannot hold
 * more overrides than there are permissions, so 8 pages of 200 is far beyond
 * any reachable state.
 */
const OVERRIDES_MAX_PAGES = 8;

/**
 * Reads EVERY override row for a user, paging until the source is exhausted.
 *
 * Stops on a short page rather than on a `total` comparison: `total` is not
 * part of what every caller's model double returns, and a `>= undefined`
 * comparison is always false — which would spin instead of stopping.
 */
const readAllOverrideRows = async (
    userPermissionModel: RUserPermissionModel,
    userId: UserIdType
): Promise<ReadonlyArray<{ permission: PermissionEnum; effect: string }>> => {
    const rows: Array<{ permission: PermissionEnum; effect: string }> = [];

    for (let page = 1; page <= OVERRIDES_MAX_PAGES; page++) {
        const { items } = await userPermissionModel.findAll(
            { userId },
            { page, pageSize: OVERRIDES_PAGE_SIZE }
        );
        rows.push(...(items as Array<{ permission: PermissionEnum; effect: string }>));
        if (items.length < OVERRIDES_PAGE_SIZE) break;
    }

    return rows;
};

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

    const items = await readAllOverrideRows(deps.userPermissionModel, userId);
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
