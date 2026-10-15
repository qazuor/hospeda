import { describe, expect, it } from 'vitest';
import {
    CONCESSION_ACTION_KEYS,
    isSuperAdminExclusivePermission,
    SUPER_ADMIN_EXCLUSIVE_PERMISSIONS,
    SUPER_ADMIN_ONLY_ACTION_KEYS,
    SUPER_ADMIN_ONLY_PERMISSION_REASON,
    withoutSuperAdminExclusivePermissions
} from '../../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionEnum } from '../../../src/enums/permission.enum.js';

describe('SUPER_ADMIN_EXCLUSIVE_PERMISSIONS', () => {
    it('exports the assignment rejection reason used by the panel', () => {
        expect(SUPER_ADMIN_ONLY_PERMISSION_REASON).toBe('SUPER_ADMIN_ONLY_PERMISSION');
    });
    it('contains exactly the closed list in order', () => {
        expect([...SUPER_ADMIN_EXCLUSIVE_PERMISSIONS]).toEqual([
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE,
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY
        ]);
    });

    it('defines the seven super-admin actions and two concession actions', () => {
        expect([...SUPER_ADMIN_ONLY_ACTION_KEYS]).toEqual([
            'ACC_17',
            'ACC_18',
            'ACC_19',
            'ACC_20',
            'ACC_21',
            'ACC_22',
            'ACC_26'
        ]);
        expect([...CONCESSION_ACTION_KEYS]).toEqual(['ACC_1', 'ACC_2']);
    });
});

describe('withoutSuperAdminExclusivePermissions', () => {
    it('removes all exclusive permissions and preserves the order in a new array', () => {
        const permissions = [
            PermissionEnum.USER_UPDATE_ROLES,
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE,
            PermissionEnum.USER_DELETE,
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY
        ];
        const filtered = withoutSuperAdminExclusivePermissions({ permissions });

        expect(filtered).toEqual([PermissionEnum.USER_UPDATE_ROLES, PermissionEnum.USER_DELETE]);
        expect(filtered).not.toBe(permissions);
        expect(permissions).toEqual([
            PermissionEnum.USER_UPDATE_ROLES,
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE,
            PermissionEnum.USER_DELETE,
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY
        ]);
    });

    it('keeps a common permission', () => {
        expect(
            withoutSuperAdminExclusivePermissions({
                permissions: [PermissionEnum.USER_UPDATE_ROLES]
            })
        ).toEqual([PermissionEnum.USER_UPDATE_ROLES]);
        expect(
            isSuperAdminExclusivePermission({ permission: PermissionEnum.USER_UPDATE_ROLES })
        ).toBe(false);
    });
});
