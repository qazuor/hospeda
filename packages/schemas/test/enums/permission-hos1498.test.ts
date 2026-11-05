import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('AC:V8b:6 ACC:25 action permission', () => {
    it('defines a unique permission for emptying Partner presence', () => {
        expect(PermissionEnum.PARTNER_EMPTY_PRESENCE).toBe('partner.emptyPresence');
        expect(
            Object.values(PermissionEnum).filter((value) => value === 'partner.emptyPresence')
        ).toHaveLength(1);
    });

    it('groups the permission with partner permissions', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.PARTNER_EMPTY_PRESENCE]).toBe(
            PermissionCategoryEnum.PARTNER
        );
    });
});
