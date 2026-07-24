import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

describe('HOS-277 ALLIANCE_LEAD permissions', () => {
    it('should have ALLIANCE_LEAD category in PermissionCategoryEnum', () => {
        expect(PermissionCategoryEnum.ALLIANCE_LEAD).toBe('ALLIANCE_LEAD');
    });

    it('should have both alliance-lead permission values', () => {
        expect(PermissionEnum.ALLIANCE_LEAD_VIEW_ALL).toBe('allianceLead.viewAll');
        expect(PermissionEnum.ALLIANCE_LEAD_MANAGE).toBe('allianceLead.manage');
    });

    it('should have exactly 2 allianceLead.* entries', () => {
        const allianceLeadPerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('allianceLead.')
        );
        expect(allianceLeadPerms).toHaveLength(2);
    });
});
