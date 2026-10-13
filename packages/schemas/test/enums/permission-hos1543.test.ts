import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-1543 cancel-subscription permission (administrative action 8, base of S36)', () => {
    it('defines the exact action 8 permission value', () => {
        // Arrange / Act
        const value = PermissionEnum.BILLING_CANCEL_SUBSCRIPTION;

        // Assert
        expect(value).toBe('billing.cancelSubscription');
    });

    it('groups the action 8 permission in BILLING by its key prefix', () => {
        // Arrange / Act
        const category = PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_CANCEL_SUBSCRIPTION];

        // Assert
        expect(category).toBe(PermissionCategoryEnum.BILLING);
    });
});
