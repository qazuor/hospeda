import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-1445 action 11 permission', () => {
    it('uses the exact trial.extend value', () => {
        expect(PermissionEnum.TRIAL_EXTEND).toBe('trial.extend');
    });

    it('deliberately falls in the SYSTEM category', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.TRIAL_EXTEND]).toBe(
            PermissionCategoryEnum.SYSTEM
        );
    });
});
