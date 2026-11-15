import { describe, expect, it } from 'vitest';
import { isSuperAdminExclusivePermission } from '../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:B10:8 action 20 permission', () => {
    it('has the agreed value, category and exclusive assignment', () => {
        expect(PermissionEnum.BILLING_PUBLISH_ADDON_VERSION).toBe('billing.publishAddonVersion');
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]).toBe(
            PermissionCategoryEnum.BILLING
        );
        expect(
            isSuperAdminExclusivePermission({
                permission: PermissionEnum.BILLING_PUBLISH_ADDON_VERSION
            })
        ).toBe(true);
    });
});
