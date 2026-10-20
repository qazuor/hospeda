import { describe, expect, it } from 'vitest';
import { PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('TEST:V8a:15 HOS-1494 account close on request permission', () => {
    it('defines the action 24 permission and groups it with user delete', () => {
        expect(PermissionEnum.USER_CLOSE_ON_REQUEST).toBe('user.closeOnRequest');
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.USER_CLOSE_ON_REQUEST]).toBe(
            PERMISSION_TO_CATEGORY[PermissionEnum.USER_DELETE]
        );
    });
});
