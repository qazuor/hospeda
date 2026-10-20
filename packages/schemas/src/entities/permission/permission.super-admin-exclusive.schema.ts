import { PermissionEnum } from '../../enums/permission.enum.js';

/** Reason exposed to the panel when a SUPER_ADMIN-only permission is assigned directly. */
export const SUPER_ADMIN_ONLY_PERMISSION_REASON = 'SUPER_ADMIN_ONLY_PERMISSION';

/**
 * Closed set of permissions that come only with the `SUPER_ADMIN` role
 * (V5.md:873-880). Each owning piece must add its permission here whenever a
 * row among the nine actions acquires a permission: ACC_17 through ACC_22,
 * ACC_26, ACC_1, or ACC_2.
 */
export const SUPER_ADMIN_EXCLUSIVE_PERMISSIONS = [
    PermissionEnum.MAINTENANCE_MODE_WRITE,
    PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE,
    PermissionEnum.BILLING_GRANT_COMPLIMENTARY,
    PermissionEnum.BILLING_MANAGE_PROMO_CODES
] as const;

/** A permission that can be held only through the `SUPER_ADMIN` role. */
export type SuperAdminExclusivePermission = (typeof SUPER_ADMIN_EXCLUSIVE_PERMISSIONS)[number];

/**
 * Checks whether a permission belongs to the closed SUPER_ADMIN-only set.
 * @param params.permission - Permission to check.
 * @returns Whether the permission is SUPER_ADMIN-exclusive.
 */
export const isSuperAdminExclusivePermission = (params: {
    readonly permission: PermissionEnum;
}): params is { readonly permission: SuperAdminExclusivePermission } =>
    (SUPER_ADMIN_EXCLUSIVE_PERMISSIONS as readonly PermissionEnum[]).includes(params.permission);

/**
 * Returns a new ordered list without SUPER_ADMIN-exclusive permissions.
 * @param params.permissions - Effective permissions to filter.
 * @returns A new array preserving input order and excluding exclusive values.
 */
export const withoutSuperAdminExclusivePermissions = (params: {
    readonly permissions: readonly PermissionEnum[];
}): PermissionEnum[] =>
    params.permissions.filter((permission) => !isSuperAdminExclusivePermission({ permission }));

/** Seven NUCLEO/08 §3 action keys marked SUPER_ADMIN-only (V5.md:327-329). */
export const SUPER_ADMIN_ONLY_ACTION_KEYS = [
    'ACC_17',
    'ACC_18',
    'ACC_19',
    'ACC_20',
    'ACC_21',
    'ACC_22',
    'ACC_26'
] as const;

/** Actions 1 and 2 share the same SUPER_ADMIN-only concession permission. */
export const CONCESSION_ACTION_KEYS = ['ACC_1', 'ACC_2'] as const;
