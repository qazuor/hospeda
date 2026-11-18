import { describe, expect, it } from 'vitest';
import { PERMISSION_TO_CATEGORY } from '../../utils/permission-grouping.js';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

/**
 * HOS-2336: the partner type catalog is admin-managed, gated by its own
 * permission set (camelCase family, like `hostTradeCategory.*`).
 */
describe('HOS-2336 PARTNER_TYPE permissions', () => {
    it('has exactly the 5 known partnerType.* values', () => {
        // Arrange
        const values = Object.values(PermissionEnum).filter((v) => v.startsWith('partnerType.'));

        // Assert
        expect(values.sort()).toEqual(
            [
                'partnerType.view',
                'partnerType.create',
                'partnerType.update',
                'partnerType.delete',
                'partnerType.restore'
            ].sort()
        );
    });

    it('maps each key to its value', () => {
        expect(PermissionEnum.PARTNER_TYPE_VIEW).toBe('partnerType.view');
        expect(PermissionEnum.PARTNER_TYPE_CREATE).toBe('partnerType.create');
        expect(PermissionEnum.PARTNER_TYPE_UPDATE).toBe('partnerType.update');
        expect(PermissionEnum.PARTNER_TYPE_DELETE).toBe('partnerType.delete');
        expect(PermissionEnum.PARTNER_TYPE_RESTORE).toBe('partnerType.restore');
    });

    it('groups the new permissions under the PARTNER category', () => {
        const keys: readonly PermissionEnum[] = [
            PermissionEnum.PARTNER_TYPE_VIEW,
            PermissionEnum.PARTNER_TYPE_CREATE,
            PermissionEnum.PARTNER_TYPE_UPDATE,
            PermissionEnum.PARTNER_TYPE_DELETE,
            PermissionEnum.PARTNER_TYPE_RESTORE
        ];
        for (const permission of keys) {
            expect(PERMISSION_TO_CATEGORY[permission]).toBe(PermissionCategoryEnum.PARTNER);
        }
    });

    it('does not change the partner.* family', () => {
        const partner = Object.values(PermissionEnum).filter((v) => v.startsWith('partner.'));
        expect(partner).toHaveLength(9);
    });
});
