import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-1487 partner owner permission', () => {
    it('defines a unique permission value for editing the own partner listing', () => {
        expect(PermissionEnum.PARTNER_EDIT_OWN).toBe('partner.editOwn');
        expect(
            Object.values(PermissionEnum).filter((value) => value === 'partner.editOwn')
        ).toHaveLength(1);
    });

    it('groups the permission with partner permissions', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.PARTNER_EDIT_OWN]).toBe(
            PermissionCategoryEnum.PARTNER
        );
    });
});
