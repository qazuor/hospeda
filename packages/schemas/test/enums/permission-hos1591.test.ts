import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:B9b:9 HOS-1591 promo code permission (action 21)', () => {
    it('defines the exact action 21 permission value', () => {
        expect(PermissionEnum.BILLING_MANAGE_PROMO_CODES).toBe('billing.managePromoCodes');
    });

    it('groups the action 21 permission in BILLING by its key prefix', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_MANAGE_PROMO_CODES]).toBe(
            PermissionCategoryEnum.BILLING
        );
    });
});
