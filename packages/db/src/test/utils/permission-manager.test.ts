import { PermissionEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../utils/permission-manager';

// Mock user with permissions
const userWithAll: { permissions: PermissionEnum[] } = {
    permissions: [
        PermissionEnum.ACCOMMODATION_VIEW_PUBLIC,
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.ACCOMMODATION_DELETE_OWN
    ]
};

const userWithSome: { permissions: PermissionEnum[] } = {
    permissions: [PermissionEnum.ACCOMMODATION_VIEW_PUBLIC, PermissionEnum.ACCOMMODATION_CREATE]
};

const userWithNone: { permissions: PermissionEnum[] } = {
    permissions: []
};

const userNoPermissionsField: object = {};

describe('hasPermission', () => {
    it('returns true if user has the single required permission', () => {
        expect(hasPermission(userWithAll, PermissionEnum.ACCOMMODATION_VIEW_PUBLIC)).toBe(true);
    });

    it('returns false if user does not have the single required permission', () => {
        expect(hasPermission(userWithSome, PermissionEnum.ACCOMMODATION_UPDATE_OWN)).toBe(false);
    });

    it('returns true if user has all required permissions (array)', () => {
        expect(
            hasPermission(userWithAll, [
                PermissionEnum.ACCOMMODATION_VIEW_PUBLIC,
                PermissionEnum.ACCOMMODATION_CREATE
            ])
        ).toBe(true);
    });

    it('returns false if user is missing one of the required permissions (array)', () => {
        expect(
            hasPermission(userWithSome, [
                PermissionEnum.ACCOMMODATION_VIEW_PUBLIC,
                PermissionEnum.ACCOMMODATION_UPDATE_OWN
            ])
        ).toBe(false);
    });

    it('returns false if user has no permissions', () => {
        expect(hasPermission(userWithNone, PermissionEnum.ACCOMMODATION_CREATE)).toBe(false);
    });

    it('returns false if user.permissions is undefined', () => {
        expect(
            hasPermission(
                userNoPermissionsField as { permissions?: PermissionEnum[] },
                PermissionEnum.ACCOMMODATION_CREATE
            )
        ).toBe(false);
    });

    it('returns false for empty permission array', () => {
        expect(hasPermission(userWithAll, [])).toBe(true); // all([]) is vacuously true
    });

    it('returns false for non-existent permission', () => {
        expect(hasPermission(userWithAll, 'NON_EXISTENT_PERMISSION' as PermissionEnum)).toBe(false);
    });
});
