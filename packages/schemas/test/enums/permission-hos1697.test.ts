import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('TEST:1697:1 AC:1697:1 HOS-1697 lift-reconciliation-mark permission', () => {
    it('defines the exact action 7 permission value', () => {
        // Arrange / Act
        const value = PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK;

        // Assert
        expect(value).toBe('billing.liftReconciliationMark');
    });

    it('groups the action 7 permission in BILLING by its key prefix', () => {
        // Arrange / Act
        const category = PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];

        // Assert
        expect(category).toBe(PermissionCategoryEnum.BILLING);
    });
});
