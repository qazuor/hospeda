import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:V5:8 HOS-1457 permissions (TEST:V5:9 support)', () => {
    it('defines the three exact permission values', () => {
        expect(PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT).toBe('listing.foreignContent.edit');
        expect(PermissionEnum.BILLING_SUBSCRIPTION_INSPECT).toBe('billing.subscription.inspect');
        expect(PermissionEnum.BILLING_VIEW_OWN).toBe('billing.viewOwn');
    });

    it('places billing permissions in BILLING and action 15 deliberately in SYSTEM', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]).toBe(
            PermissionCategoryEnum.BILLING
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.BILLING_VIEW_OWN]).toBe(
            PermissionCategoryEnum.BILLING
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]).toBe(
            PermissionCategoryEnum.SYSTEM
        );
    });
});
