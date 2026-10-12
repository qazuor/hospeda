import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('TEST:V6:12 HOS-1475 listing moderation permission', () => {
    it('defines the action 13 permission and groups it with foreign listing moderation', () => {
        expect(PermissionEnum.LISTING_MODERATE).toBe('listing.moderate');
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_MODERATE]).toBe(
            PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.LISTING_MODERATE]).toBe(
            PermissionCategoryEnum.SYSTEM
        );
    });
});
