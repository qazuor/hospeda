import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:V7:17 ACC:6 action permission', () => {
    it('defines a unique permission for configuring Partner billing', () => {
        expect(PermissionEnum.PARTNER_CONFIGURE_BILLING).toBe('partner.configureBilling');
        expect(
            Object.values(PermissionEnum).filter((value) => value === 'partner.configureBilling')
        ).toHaveLength(1);
    });

    it('groups the permission with partner permissions', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.PARTNER_CONFIGURE_BILLING]).toBe(
            PermissionCategoryEnum.PARTNER
        );
    });
});
