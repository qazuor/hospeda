import { describe, expect, it } from 'vitest';
import { PERMISSION_TO_CATEGORY } from '../../utils/permission-grouping.js';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

/**
 * HOS-919: the provider trade category catalog is admin-managed, gated by its
 * own permission set. The same five permissions gate groups and categories,
 * because both tables are one catalog.
 */
describe('HOS-919 HOST_TRADE_CATEGORY permissions', () => {
    it('has exactly the 5 known hostTradeCategory.* values', () => {
        // Arrange
        const values = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('hostTradeCategory.')
        );

        // Assert
        expect(values.sort()).toEqual(
            [
                'hostTradeCategory.view',
                'hostTradeCategory.create',
                'hostTradeCategory.update',
                'hostTradeCategory.delete',
                'hostTradeCategory.restore'
            ].sort()
        );
    });

    it('maps each key to its value', () => {
        expect(PermissionEnum.HOST_TRADE_CATEGORY_VIEW).toBe('hostTradeCategory.view');
        expect(PermissionEnum.HOST_TRADE_CATEGORY_CREATE).toBe('hostTradeCategory.create');
        expect(PermissionEnum.HOST_TRADE_CATEGORY_UPDATE).toBe('hostTradeCategory.update');
        expect(PermissionEnum.HOST_TRADE_CATEGORY_DELETE).toBe('hostTradeCategory.delete');
        expect(PermissionEnum.HOST_TRADE_CATEGORY_RESTORE).toBe('hostTradeCategory.restore');
    });

    it('groups the new permissions under the HOST_TRADE category', () => {
        const keys: readonly PermissionEnum[] = [
            PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
            PermissionEnum.HOST_TRADE_CATEGORY_CREATE,
            PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
            PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
            PermissionEnum.HOST_TRADE_CATEGORY_RESTORE
        ];
        for (const permission of keys) {
            expect(PERMISSION_TO_CATEGORY[permission]).toBe(PermissionCategoryEnum.HOST_TRADE);
        }
    });

    it('does not change the hostTrade.* family', () => {
        const hostTrade = Object.values(PermissionEnum).filter((v) => v.startsWith('hostTrade.'));
        expect(hostTrade).toHaveLength(12);
    });
});
