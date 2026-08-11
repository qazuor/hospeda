import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

describe('SPEC-241 HOST_TRADE permissions', () => {
    it('should have HOST_TRADE category in PermissionCategoryEnum', () => {
        expect(PermissionCategoryEnum.HOST_TRADE).toBe('HOST_TRADE');
    });

    it('should have all 7 host-trade permission values', () => {
        expect(PermissionEnum.HOST_TRADE_VIEW).toBe('hostTrade.view');
        expect(PermissionEnum.HOST_TRADE_CREATE).toBe('hostTrade.create');
        expect(PermissionEnum.HOST_TRADE_UPDATE).toBe('hostTrade.update');
        expect(PermissionEnum.HOST_TRADE_DELETE).toBe('hostTrade.delete');
        expect(PermissionEnum.HOST_TRADE_RESTORE).toBe('hostTrade.restore');
        expect(PermissionEnum.HOST_TRADE_HARD_DELETE).toBe('hostTrade.hardDelete');
        expect(PermissionEnum.HOST_TRADE_VIEW_ALL).toBe('hostTrade.viewAll');
    });

    it('should have all 5 HOS-376 usage + review permission values', () => {
        expect(PermissionEnum.HOST_TRADE_REVIEW_CREATE).toBe('hostTrade.review.create');
        expect(PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL).toBe('hostTrade.review.viewAll');
        expect(PermissionEnum.HOST_TRADE_REVIEW_MODERATE).toBe('hostTrade.review.moderate');
        expect(PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL).toBe('hostTrade.usage.viewAll');
        expect(PermissionEnum.HOST_TRADE_USAGE_MANAGE).toBe('hostTrade.usage.manage');
    });

    /**
     * The count is 12, not 7, since HOS-376 §7.4 added the usage + review block.
     *
     * The assertion is by NAME rather than by length alone: a bare
     * `toHaveLength(12)` is satisfied by any twelve strings, so a typo'd or
     * renamed permission would keep it green while the seed's role grants — which
     * are matched by string value — silently stop resolving.
     */
    it('should have exactly the 12 known hostTrade.* entries', () => {
        const hostTradePerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('hostTrade.')
        );
        expect(hostTradePerms.sort()).toEqual(
            [
                'hostTrade.view',
                'hostTrade.create',
                'hostTrade.update',
                'hostTrade.delete',
                'hostTrade.restore',
                'hostTrade.hardDelete',
                'hostTrade.viewAll',
                'hostTrade.review.create',
                'hostTrade.review.viewAll',
                'hostTrade.review.moderate',
                'hostTrade.usage.viewAll',
                'hostTrade.usage.manage'
            ].sort()
        );
    });
});
