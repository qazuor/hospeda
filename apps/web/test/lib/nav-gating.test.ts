import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import {
    ROLES_WITH_ACCOMMODATIONS_NAV,
    ROLES_WITH_COMMERCE_NAV
} from '../../src/lib/account-roles';
import {
    isVisibleByPermissions,
    isVisibleByRole,
    PERMISSION_ROLE_MAP
} from '../../src/lib/nav-gating';

describe('PERMISSION_ROLE_MAP', () => {
    it('mirrors ROLES_WITH_ACCOMMODATIONS_NAV for ACCOMMODATION_CREATE', () => {
        const mapped = PERMISSION_ROLE_MAP[PermissionEnum.ACCOMMODATION_CREATE];
        expect(mapped).toBeDefined();
        expect(new Set(mapped)).toEqual(ROLES_WITH_ACCOMMODATIONS_NAV);
    });

    it('mirrors ROLES_WITH_COMMERCE_NAV for COMMERCE_EDIT_OWN', () => {
        const mapped = PERMISSION_ROLE_MAP[PermissionEnum.COMMERCE_EDIT_OWN];
        expect(mapped).toBeDefined();
        expect(new Set(mapped)).toEqual(ROLES_WITH_COMMERCE_NAV);
    });

    it('keeps the two role sets distinct (HOST is not a commerce role, COMMERCE_OWNER is not a host role)', () => {
        expect(PERMISSION_ROLE_MAP[PermissionEnum.COMMERCE_EDIT_OWN]?.has(RoleEnum.HOST)).toBe(
            false
        );
        expect(
            PERMISSION_ROLE_MAP[PermissionEnum.ACCOMMODATION_CREATE]?.has(RoleEnum.COMMERCE_OWNER)
        ).toBe(false);
    });
});

describe('isVisibleByPermissions (client, exact evaluation)', () => {
    it('is always visible when the node declares no requiredPermission', () => {
        expect(isVisibleByPermissions({}, [])).toBe(true);
    });

    it('is visible when the effective permission list contains the required permission', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByPermissions(node, [PermissionEnum.ACCOMMODATION_CREATE])).toBe(true);
    });

    it('is hidden when the effective permission list does not contain the required permission', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByPermissions(node, [PermissionEnum.COMMERCE_EDIT_OWN])).toBe(false);
        expect(isVisibleByPermissions(node, [])).toBe(false);
    });

    it('fails closed (hidden) while the effective-permissions fetch is still in flight', () => {
        const gatedNode = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        // Simulating loading state: caller passes `[]`, per the documented
        // contract, before `GET /api/v1/public/auth/me` has resolved. The
        // gated node must stay hidden rather than flash visible-then-hidden.
        expect(isVisibleByPermissions(gatedNode, [])).toBe(false);
    });
});

describe('isVisibleByRole (server SSR, approximate evaluation)', () => {
    it('is always visible when the node declares no requiredPermission, even for an anonymous visitor', () => {
        expect(isVisibleByRole({}, null)).toBe(true);
    });

    it('is hidden for an anonymous visitor (role = null) on a gated node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRole(node, null)).toBe(false);
    });

    it('is visible for HOST on an ACCOMMODATION_CREATE node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRole(node, RoleEnum.HOST)).toBe(true);
    });

    it('is hidden for a plain USER on an ACCOMMODATION_CREATE node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRole(node, RoleEnum.USER)).toBe(false);
    });

    it('fails closed (hidden) for a role string absent from every PERMISSION_ROLE_MAP set', () => {
        const gatedNode = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRole(gatedNode, 'BOGUS_ROLE')).toBe(false);
    });

    it('is visible for COMMERCE_OWNER on a COMMERCE_EDIT_OWN node, but not for HOST', () => {
        const node = { requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN };
        expect(isVisibleByRole(node, RoleEnum.COMMERCE_OWNER)).toBe(true);
        expect(isVisibleByRole(node, RoleEnum.HOST)).toBe(false);
    });

    it('is visible for platform staff (ADMIN, SUPER_ADMIN) on both gated permissions', () => {
        const hostNode = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        const commerceNode = { requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN };
        expect(isVisibleByRole(hostNode, RoleEnum.ADMIN)).toBe(true);
        expect(isVisibleByRole(commerceNode, RoleEnum.ADMIN)).toBe(true);
        expect(isVisibleByRole(hostNode, RoleEnum.SUPER_ADMIN)).toBe(true);
        expect(isVisibleByRole(commerceNode, RoleEnum.SUPER_ADMIN)).toBe(true);
    });
});
