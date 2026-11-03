import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-1541 administrative manual payment permissions', () => {
    it('defines the dedicated permission for ACC_3', () => {
        expect(PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT).toBe(
            'billing.registerManualPayment'
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]).toBe(
            PermissionCategoryEnum.BILLING
        );
    });

    it('defines the dedicated permission for ACC_4', () => {
        expect(PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID).toBe('billing.declareManualUnpaid');
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID]).toBe(
            PermissionCategoryEnum.BILLING
        );
    });
});
