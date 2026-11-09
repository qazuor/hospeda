import { describe, expect, it } from 'vitest';
import { isSuperAdminExclusivePermission } from '../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:B12:2 action 17 is separate from publishing a plan version', () => {
    it('has its own billing permission and SUPER_ADMIN-exclusive assignment', () => {
        expect(PermissionEnum.BILLING_MIGRATE_PLAN).toBe('billing.migratePlan');
        expect(PermissionEnum.BILLING_MIGRATE_PLAN).not.toBe(
            PermissionEnum.BILLING_PUBLISH_ADDON_VERSION
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_MIGRATE_PLAN]).toBe(
            PermissionCategoryEnum.BILLING
        );
        expect(
            isSuperAdminExclusivePermission({ permission: PermissionEnum.BILLING_MIGRATE_PLAN })
        ).toBe(true);
    });
});
