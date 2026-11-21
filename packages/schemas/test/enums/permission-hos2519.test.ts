import { describe, expect, it } from 'vitest';
import {
    isSuperAdminExclusivePermission,
    SUPER_ADMIN_EXCLUSIVE_PERMISSIONS
} from '../../src/entities/permission/permission.super-admin-exclusive.schema.js';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

describe('HOS-2519 email template preview permission', () => {
    it('AC-6.1: has the agreed value and is defined exactly once', () => {
        // Arrange / Act
        const value = PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW;

        // Assert
        expect(value).toBe('notification.template.preview');
        expect(
            Object.values(PermissionEnum).filter(
                (permission) => permission === 'notification.template.preview'
            )
        ).toHaveLength(1);
    });

    it('AC-6.1: is derived into the NOTIFICATION category by key prefix (D8)', () => {
        expect(PERMISSION_TO_CATEGORY[PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW]).toBe(
            PermissionCategoryEnum.NOTIFICATION
        );
    });

    it('is NOT a SUPER_ADMIN-exclusive permission (OQ-3: SUPER_ADMIN and ADMIN)', () => {
        expect(
            isSuperAdminExclusivePermission({
                permission: PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW
            })
        ).toBe(false);
        expect(
            (SUPER_ADMIN_EXCLUSIVE_PERMISSIONS as readonly string[]).includes(
                PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW
            )
        ).toBe(false);
    });
});
