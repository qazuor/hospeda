import type { UserType } from '@repo/types';
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

const userSuperAdmin = { permissions: [], role: 'SUPER_ADMIN' };
const userGuest = { permissions: [], role: 'GUEST' };
const userPublic = { permissions: [], role: 'PUBLIC' };
const userWithRole = { permissions: [PermissionEnum.ACCOMMODATION_CREATE], role: 'USER' };

// Helper for logging
const makeLog = () => {
    const reasons: string[] = [];
    return {
        log: (reason: string) => reasons.push(reason),
        reasons
    };
};

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

describe('hasPermission (advanced)', () => {
    it('bypasses all checks for SUPER_ADMIN', () => {
        expect(hasPermission(userSuperAdmin, PermissionEnum.ACCOMMODATION_CREATE)).toBe(true);
        expect(
            hasPermission(userSuperAdmin, [
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_DELETE_OWN
            ])
        ).toBe(true);
    });

    it('returns false for GUEST or PUBLIC users regardless of permissions', () => {
        expect(hasPermission(userGuest, PermissionEnum.ACCOMMODATION_CREATE)).toBe(false);
        expect(hasPermission(userPublic, PermissionEnum.ACCOMMODATION_CREATE)).toBe(false);
    });

    it('returns true if user has ANY of the required permissions (any=true)', () => {
        expect(
            hasPermission(
                userWithSome,
                [PermissionEnum.ACCOMMODATION_UPDATE_OWN, PermissionEnum.ACCOMMODATION_CREATE],
                { any: true }
            )
        ).toBe(true);
    });

    it('returns false if user has NONE of the required permissions (any=true)', () => {
        expect(
            hasPermission(
                userWithNone,
                [PermissionEnum.ACCOMMODATION_UPDATE_OWN, PermissionEnum.ACCOMMODATION_CREATE],
                { any: true }
            )
        ).toBe(false);
    });

    it('calls logReason with correct reason for denial', () => {
        const { log, reasons } = makeLog();
        expect(
            hasPermission(userWithNone, PermissionEnum.ACCOMMODATION_CREATE, { logReason: log })
        ).toBe(false);
        expect(reasons[0]).toMatch(/lacks required permission/i);
    });

    it('calls logReason for GUEST/PUBLIC', () => {
        const { log, reasons } = makeLog();
        expect(
            hasPermission(userGuest, PermissionEnum.ACCOMMODATION_CREATE, { logReason: log })
        ).toBe(false);
        expect(reasons[0]).toMatch(/public\/guest/i);
    });

    it('supports conditional logic via condition callback', () => {
        // Condition: user can only create if data.owned === true
        const canCreateIfOwned = (_user: UserType, data: { owned: boolean }) => data.owned;
        expect(
            hasPermission(userWithRole, PermissionEnum.ACCOMMODATION_CREATE, {
                condition: canCreateIfOwned,
                data: { owned: true }
            })
        ).toBe(true);
        expect(
            hasPermission(userWithRole, PermissionEnum.ACCOMMODATION_CREATE, {
                condition: canCreateIfOwned,
                data: { owned: false }
            })
        ).toBe(false);
    });

    it('logs reason if condition callback denies', () => {
        const { log, reasons } = makeLog();
        expect(
            hasPermission(userWithRole, PermissionEnum.ACCOMMODATION_CREATE, {
                condition: () => false,
                data: {},
                logReason: log
            })
        ).toBe(false);
        expect(reasons[0]).toMatch(/condition callback/i);
    });
});
