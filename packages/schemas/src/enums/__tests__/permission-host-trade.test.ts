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

    it('should have exactly 7 hostTrade.* entries', () => {
        const hostTradePerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('hostTrade.')
        );
        expect(hostTradePerms).toHaveLength(7);
    });
});
