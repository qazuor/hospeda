import { describe, expect, it } from 'vitest';
import {
    isSuperAdminExclusivePermission,
    SUPER_ADMIN_EXCLUSIVE_PERMISSIONS
} from '../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-2347 session recording permission', () => {
    it('AC-PE1: has the agreed camelCase value in the analytics family', () => {
        // Arrange / Act
        const value = PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE;

        // Assert
        expect(value).toBe('analytics.sessionRecording.manage');
    });

    it('AC-PE4: sits in the SYSTEM category next to ANALYTICS_VIEW (same deliberate fallback)', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE]).toBe(
            PermissionCategoryEnum.SYSTEM
        );
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.ANALYTICS_VIEW]).toBe(
            PermissionCategoryEnum.SYSTEM
        );
    });

    it('AC-PE5: is NOT a SUPER_ADMIN-exclusive permission (D-3: seed grant only)', () => {
        expect(
            isSuperAdminExclusivePermission({
                permission: PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE
            })
        ).toBe(false);
        expect(
            (SUPER_ADMIN_EXCLUSIVE_PERMISSIONS as readonly string[]).includes(
                PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE
            )
        ).toBe(false);
    });
});
