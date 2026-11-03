import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('TEST:HOS-1551:1 ACC_13 refund permission', () => {
    it('defines the dedicated billing refund permission', () => {
        expect(PermissionEnum.BILLING_REFUND).toBe('billing.refund');
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_REFUND]).toBe(
            PermissionCategoryEnum.BILLING
        );
    });
});
