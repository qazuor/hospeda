import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed';

const moderationPermissions = [
    PermissionEnum.MODERATION_TERM_VIEW,
    PermissionEnum.MODERATION_TERM_CREATE,
    PermissionEnum.MODERATION_TERM_UPDATE,
    PermissionEnum.MODERATION_TERM_DELETE,
    PermissionEnum.MODERATION_TERM_RESTORE,
    PermissionEnum.MODERATION_TERM_HARD_DELETE,
    PermissionEnum.MODERATION_THRESHOLD_VIEW,
    PermissionEnum.MODERATION_THRESHOLD_UPDATE,
    PermissionEnum.MODERATION_THRESHOLD_RESTORE,
    PermissionEnum.MODERATION_THRESHOLD_HARD_DELETE
] as const;

describe('SPEC-195 moderation permissions seeded for staff roles', () => {
    for (const permission of moderationPermissions) {
        it(`grants ${permission} to SUPER_ADMIN`, () => {
            expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(permission);
        });

        it(`grants ${permission} to ADMIN`, () => {
            expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).toContain(permission);
        });
    }

    it('does not grant moderation term delete to HOST', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.HOST]).not.toContain(
            PermissionEnum.MODERATION_TERM_DELETE
        );
    });
});
