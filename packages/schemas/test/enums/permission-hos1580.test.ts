import { describe, expect, it } from 'vitest';
import { isSuperAdminExclusivePermission } from '../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:B8b:22 HOS-1580 admin action permissions', () => {
    it('defines one exact permission for each administrative action', () => {
        expect(PermissionEnum.BILLING_PAUSE_SUBSCRIPTION).toBe('billing.pauseSubscription');
        expect(PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN).toBe(
            'billing.changeSubscriptionPlan'
        );
    });

    it('groups both permissions in billing without making them exclusive', () => {
        for (const permission of [
            PermissionEnum.BILLING_PAUSE_SUBSCRIPTION,
            PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN
        ]) {
            expect(PERMISSION_TO_CATEGORY[permission]).toBe(PermissionCategoryEnum.BILLING);
            expect(isSuperAdminExclusivePermission({ permission })).toBe(false);
        }
    });
});
