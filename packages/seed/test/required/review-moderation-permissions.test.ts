/**
 * SPEC-166 T-018 — seed assertion: ACCOMMODATION_REVIEW_MODERATE and
 * DESTINATION_REVIEW_MODERATE must be granted to both ADMIN and SUPER_ADMIN.
 *
 * These permissions already existed in the seed before SPEC-166 (per spec §3.3).
 * This test is the regression guard that prevents them from being accidentally
 * revoked in future seed changes.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed';

describe('SPEC-166 T-018 — review moderation permissions seeded for staff roles', () => {
    it('SUPER_ADMIN holds ACCOMMODATION_REVIEW_MODERATE', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(
            PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
        );
    });

    it('ADMIN holds ACCOMMODATION_REVIEW_MODERATE', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).toContain(
            PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
        );
    });

    it('SUPER_ADMIN holds DESTINATION_REVIEW_MODERATE', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(
            PermissionEnum.DESTINATION_REVIEW_MODERATE
        );
    });

    it('ADMIN holds DESTINATION_REVIEW_MODERATE', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).toContain(
            PermissionEnum.DESTINATION_REVIEW_MODERATE
        );
    });

    it('HOST does NOT hold ACCOMMODATION_REVIEW_MODERATE (non-staff must not moderate)', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.HOST]).not.toContain(
            PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
        );
    });

    it('USER does NOT hold DESTINATION_REVIEW_MODERATE (non-staff must not moderate)', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.USER]).not.toContain(
            PermissionEnum.DESTINATION_REVIEW_MODERATE
        );
    });
});
