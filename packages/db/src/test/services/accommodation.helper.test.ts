import { PermissionEnum, RoleEnum, type UserId } from '@repo/types';
import { describe, expect, it, vi } from 'vitest';
import {
    CanViewReasonEnum,
    canViewAccommodation,
    logDenied
} from '../../../src/services/accommodation/accommodation.helper';
import { getMockPublicUser, getMockUser } from '../mockData';

/**
 * Unit tests for canViewAccommodation helper.
 * Covers all visibility, ownership, and permission scenarios.
 * @see canViewAccommodation
 */
describe('canViewAccommodation', () => {
    const owner = getMockUser({ id: 'user-1' as UserId, role: RoleEnum.USER });
    const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
    const superAdmin = getMockUser({ id: 'admin-2' as UserId, role: RoleEnum.SUPER_ADMIN });
    const user = getMockUser({ id: 'user-2' as UserId, role: RoleEnum.USER });
    const publicUser = getMockPublicUser();

    it('allows public access for PUBLIC visibility', () => {
        const result = canViewAccommodation(publicUser, { visibility: 'PUBLIC' });
        expect(result.canView).toBe(true);
        expect(result.reason).toBe('public visibility');
    });

    it('allows owner access for PRIVATE visibility', () => {
        const result = canViewAccommodation(owner, { visibility: 'PRIVATE', ownerId: owner.id });
        expect(result.canView).toBe(true);
        expect(result.reason).toBe('owner access');
    });

    it('allows admin bypass for PRIVATE visibility', () => {
        const result = canViewAccommodation(admin, { visibility: 'PRIVATE', ownerId: owner.id });
        expect(result.canView).toBe(true);
        expect(result.reason).toBe('admin/superadmin bypass');
    });

    it('allows superadmin bypass for DRAFT visibility', () => {
        const result = canViewAccommodation(superAdmin, { visibility: 'DRAFT', ownerId: owner.id });
        expect(result.canView).toBe(true);
        expect(result.reason).toBe('admin/superadmin bypass');
    });

    it('requires permission for PRIVATE visibility (not owner, not admin)', () => {
        const result = canViewAccommodation(user, { visibility: 'PRIVATE', ownerId: owner.id });
        expect(result.canView).toBe(false);
        expect(result.reason).toBe('permission check required');
        expect(result.checkedPermission).toBe(PermissionEnum.ACCOMMODATION_VIEW_PRIVATE);
    });

    it('requires permission for DRAFT visibility (not owner, not admin)', () => {
        const result = canViewAccommodation(user, { visibility: 'DRAFT', ownerId: owner.id });
        expect(result.canView).toBe(false);
        expect(result.reason).toBe('permission check required');
        expect(result.checkedPermission).toBe(PermissionEnum.ACCOMMODATION_VIEW_DRAFT);
    });

    it('denies access for unknown visibility', () => {
        const result = canViewAccommodation(user, { visibility: 'UNKNOWN', ownerId: owner.id });
        expect(result.canView).toBe(false);
        expect(result.reason).toBe('unknown visibility');
        expect(result.checkedPermission).toBeUndefined();
    });
});

/**
 * Unit test for logDenied helper.
 * Ensures correct logging structure for denied access.
 * @see logDenied
 */
describe('logDenied', () => {
    it('calls dbLogger.permission with correct arguments', () => {
        const mockLogger = { permission: vi.fn() };
        const actor = getMockUser({ id: 'user-1' as UserId, role: RoleEnum.USER });
        logDenied(
            mockLogger,
            actor,
            { foo: 'bar' },
            { visibility: 'PRIVATE' },
            CanViewReasonEnum.MISSING_PERMISSION,
            PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
        );
        expect(mockLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                userId: actor.id,
                roleId: actor.role,
                extraData: expect.objectContaining({ error: 'missing permission' })
            })
        );
    });
});
