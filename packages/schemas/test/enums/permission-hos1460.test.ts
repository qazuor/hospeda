import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-1460 SUPER_ADMIN-exclusive permissions', () => {
    it('defines the exact action 26 and concession values', () => {
        expect(PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE).toBe('user.manageSuperAdminRole');
        expect(PermissionEnum.BILLING_GRANT_COMPLIMENTARY).toBe('billing.grantComplimentary');
    });

    it('groups each permission by its key prefix', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE]).toBe(
            PERMISSION_TO_CATEGORY[PermissionEnum.USER_DELETE]
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE]).toBe(
            PermissionCategoryEnum.USER
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_GRANT_COMPLIMENTARY]).toBe(
            PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_SETTLE_EXTERNAL]
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_GRANT_COMPLIMENTARY]).toBe(
            PermissionCategoryEnum.BILLING
        );
    });
});
