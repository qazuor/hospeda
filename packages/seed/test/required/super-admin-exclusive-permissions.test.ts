import { RoleEnum, SUPER_ADMIN_EXCLUSIVE_PERMISSIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

describe('SUPER_ADMIN-exclusive required role permissions', () => {
    it('gives none of the exclusive permissions to any other role', () => {
        expect(SUPER_ADMIN_EXCLUSIVE_PERMISSIONS.length).toBeGreaterThan(0);
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            if (role === RoleEnum.SUPER_ADMIN) continue;
            for (const permission of SUPER_ADMIN_EXCLUSIVE_PERMISSIONS) {
                expect(permissions, `${role} must not receive ${permission}`).not.toContain(
                    permission
                );
            }
        }
    });

    it('gives SUPER_ADMIN both new permissions', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain('user.manageSuperAdminRole');
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain('billing.grantComplimentary');
    });

    it('AC:B9b:9 HOS-1591 gives SUPER_ADMIN the action 21 permission', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain('billing.managePromoCodes');
    });

    it('AC:B2:4 HOS-1515 gives SUPER_ADMIN the action 19 permission', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain('billing.setCyclePrice');
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).not.toContain('billing.setCyclePrice');
    });

    it('AC:B10:8 HOS-1595 gives SUPER_ADMIN the action 20 permission', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain('billing.publishAddonVersion');
    });

    it('AC:B12:2 gives SUPER_ADMIN only the action 17 permission', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain('billing.migratePlan');
        expect(
            ROLE_PERMISSIONS[RoleEnum.ADMIN].filter((p) => p === 'billing.migratePlan')
        ).toHaveLength(0);
    });

    it('checks a non-empty instrument and a known ADMIN permission', () => {
        expect(SUPER_ADMIN_EXCLUSIVE_PERMISSIONS.length).toBeGreaterThan(0);
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).toContain('user.update.roles');
    });
});
