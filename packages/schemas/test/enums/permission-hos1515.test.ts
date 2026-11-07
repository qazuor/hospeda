import { describe, expect, it } from 'vitest';
import { isSuperAdminExclusivePermission } from '../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:B2:4 HOS-1515 cycle price permission (action 19)', () => {
    it('defines the exact action 19 permission value', () => {
        expect(PermissionEnum.BILLING_SET_CYCLE_PRICE).toBe('billing.setCyclePrice');
    });

    it('groups the action 19 permission in BILLING by its key prefix', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_SET_CYCLE_PRICE]).toBe(
            PermissionCategoryEnum.BILLING
        );
    });

    it('recognises the action 19 permission as SUPER_ADMIN-exclusive', () => {
        expect(
            isSuperAdminExclusivePermission({ permission: PermissionEnum.BILLING_SET_CYCLE_PRICE })
        ).toBe(true);
        expect(isSuperAdminExclusivePermission({ permission: PermissionEnum.BILLING_REFUND })).toBe(
            false
        );
    });
});
