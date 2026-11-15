import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-1484 action 5 permission', () => {
    it('defines a unique permission value for resolving partner applications', () => {
        expect(PermissionEnum.PARTNER_RESOLVE_APPLICATION).toBe('partner.resolveApplication');
        expect(
            Object.values(PermissionEnum).filter((value) => value === 'partner.resolveApplication')
        ).toHaveLength(1);
    });

    it('groups the permission with partner permissions', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.PARTNER_RESOLVE_APPLICATION]).toBe(
            PermissionCategoryEnum.PARTNER
        );
    });
});
