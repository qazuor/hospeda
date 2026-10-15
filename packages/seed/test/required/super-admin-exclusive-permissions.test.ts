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

    it('checks a non-empty instrument and a known ADMIN permission', () => {
        expect(SUPER_ADMIN_EXCLUSIVE_PERMISSIONS.length).toBeGreaterThan(0);
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).toContain('user.update.roles');
    });
});
