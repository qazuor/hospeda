import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('TEST:B5:6 HOS-1540 settle-external permission (action 14)', () => {
    it('defines the exact action 14 permission value', () => {
        // Arrange / Act
        const value = PermissionEnum.BILLING_SETTLE_EXTERNAL;

        // Assert
        expect(value).toBe('billing.settleExternal');
    });

    it('groups the action 14 permission in BILLING by its key prefix', () => {
        // Arrange / Act
        const category = PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_SETTLE_EXTERNAL];

        // Assert
        expect(category).toBe(PermissionCategoryEnum.BILLING);
    });
});
