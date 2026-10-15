import {
    PermissionEnum,
    ServiceErrorCode,
    SUPER_ADMIN_ONLY_PERMISSION_REASON
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { assertPermissionIsNotSuperAdminExclusive } from '../../../src/services/permission/permission.service.super-admin-exclusive';

describe('assertPermissionIsNotSuperAdminExclusive', () => {
    it('rejects an exclusive permission with the panel reason and no permission id', () => {
        try {
            assertPermissionIsNotSuperAdminExclusive({
                permission: PermissionEnum.MAINTENANCE_MODE_WRITE
            });
            throw new Error('expected exclusive permission rejection');
        } catch (error) {
            expect(error).toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                reason: SUPER_ADMIN_ONLY_PERMISSION_REASON
            });
            expect((error as Error).message).not.toContain(PermissionEnum.MAINTENANCE_MODE_WRITE);
        }
    });

    it('allows a common permission', () => {
        expect(() =>
            assertPermissionIsNotSuperAdminExclusive({ permission: PermissionEnum.POST_VIEW_ALL })
        ).not.toThrow();
    });
});
