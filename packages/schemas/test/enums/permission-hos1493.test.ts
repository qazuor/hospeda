import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('TEST:V8a:10 HOS-1493 listing purge on request permission', () => {
    it('defines the action 23 permission and groups it with foreign listing content edit', () => {
        expect(PermissionEnum.LISTING_PURGE_ON_REQUEST).toBe('listing.purgeOnRequest');
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_PURGE_ON_REQUEST]).toBe(
            PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_PURGE_ON_REQUEST]).toBe(
            PermissionCategoryEnum.SYSTEM
        );
    });
});
