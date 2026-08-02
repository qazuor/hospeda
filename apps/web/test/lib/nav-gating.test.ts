import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import {
    ROLES_WITH_ACCOMMODATIONS_NAV,
    ROLES_WITH_COMMERCE_NAV
} from '../../src/lib/account-roles';
import {
    hasAccommodationsNavAccess,
    hasCommerceNavAccess,
    isDoorVisible,
    isVisibleByPermissions,
    isVisibleByRoles,
    PERMISSION_ROLE_MAP,
    resolveDoorLabelKey,
    resolveDoorOptionState
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

    it('grants POST_CREATE to EDITOR (and platform staff), but not HOST or COMMERCE_OWNER (HOS-134 editor door signal)', () => {
        const mapped = PERMISSION_ROLE_MAP[PermissionEnum.POST_CREATE];
        expect(mapped).toBeDefined();
        expect(mapped?.has(RoleEnum.EDITOR)).toBe(true);
        expect(mapped?.has(RoleEnum.ADMIN)).toBe(true);
        expect(mapped?.has(RoleEnum.SUPER_ADMIN)).toBe(true);
        expect(mapped?.has(RoleEnum.HOST)).toBe(false);
        expect(mapped?.has(RoleEnum.COMMERCE_OWNER)).toBe(false);
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

describe('isVisibleByRoles (server SSR, approximate evaluation)', () => {
    it('is always visible when the node declares no requiredPermission, even for an anonymous visitor', () => {
        expect(isVisibleByRoles({}, null)).toBe(true);
    });

    it('is hidden for an anonymous visitor (role = null) on a gated node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRoles(node, null)).toBe(false);
    });

    it('is visible for HOST on an ACCOMMODATION_CREATE node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRoles(node, [RoleEnum.HOST])).toBe(true);
    });

    it('is hidden for a plain USER on an ACCOMMODATION_CREATE node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRoles(node, [RoleEnum.USER])).toBe(false);
    });

    it('fails closed (hidden) for a role string absent from every PERMISSION_ROLE_MAP set', () => {
        const gatedNode = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRoles(gatedNode, ['BOGUS_ROLE'])).toBe(false);
    });

    it('is visible for COMMERCE_OWNER on a COMMERCE_EDIT_OWN node, but not for HOST', () => {
        const node = { requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN };
        expect(isVisibleByRoles(node, [RoleEnum.COMMERCE_OWNER])).toBe(true);
        expect(isVisibleByRoles(node, [RoleEnum.HOST])).toBe(false);
    });

    it('is visible for platform staff (ADMIN, SUPER_ADMIN) on both gated permissions', () => {
        const hostNode = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        const commerceNode = { requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN };
        expect(isVisibleByRoles(hostNode, [RoleEnum.ADMIN])).toBe(true);
        expect(isVisibleByRoles(commerceNode, [RoleEnum.ADMIN])).toBe(true);
        expect(isVisibleByRoles(hostNode, [RoleEnum.SUPER_ADMIN])).toBe(true);
        expect(isVisibleByRoles(commerceNode, [RoleEnum.SUPER_ADMIN])).toBe(true);
    });

    it('is hidden for an empty role set (guest / unresolved) on a gated node', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRoles(node, [])).toBe(false);
    });

    it('is hidden when NO held role grants the permission, even with several hats', () => {
        const node = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(isVisibleByRoles(node, [RoleEnum.USER, RoleEnum.COMMERCE_OWNER])).toBe(false);
    });
});

describe('AC-1 — HOST + COMMERCE_OWNER sees BOTH nav groups (HOS-296)', () => {
    // The core acceptance criterion of the multi-role cut. Under the previous
    // scalar `role` these two assertions were mutually exclusive by
    // construction: whichever hat the column happened to hold won, and the
    // other group vanished from the sidebar entirely.
    const hostNode = { requiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
    const commerceNode = { requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN };
    const multiHatRoles = [RoleEnum.USER, RoleEnum.HOST, RoleEnum.COMMERCE_OWNER];

    it('shows the accommodations/host group', () => {
        expect(isVisibleByRoles(hostNode, multiHatRoles)).toBe(true);
    });

    it('shows the commerce group', () => {
        expect(isVisibleByRoles(commerceNode, multiHatRoles)).toBe(true);
    });

    it('shows both regardless of the order the roles arrive in', () => {
        const reversed = [...multiHatRoles].reverse();
        expect(isVisibleByRoles(hostNode, reversed)).toBe(true);
        expect(isVisibleByRoles(commerceNode, reversed)).toBe(true);
    });

    it('still hides a group neither hat grants (POST_CREATE stays editor-only)', () => {
        const editorNode = { requiredPermission: PermissionEnum.POST_CREATE };
        expect(isVisibleByRoles(editorNode, multiHatRoles)).toBe(false);
        // …and appears as soon as the editor hat is added to the same account.
        expect(isVisibleByRoles(editorNode, [...multiHatRoles, RoleEnum.EDITOR])).toBe(true);
    });

    it('exposes the same verdict through the named page-gate wrappers', () => {
        // The `/mi-cuenta/*` page guards call these, so they must agree with
        // the sidebar evaluator above (HOS-296 §6.5: one gating mechanism).
        expect(hasAccommodationsNavAccess({ roles: multiHatRoles })).toBe(true);
        expect(hasCommerceNavAccess({ roles: multiHatRoles })).toBe(true);
    });
});

describe('resolveDoorOptionState (HOS-131 §6.3, OQ-3: acquired signal = permissions)', () => {
    const byRole =
        (role: string | null) => (node: { readonly requiredPermission?: PermissionEnum }) =>
            isVisibleByRoles(node, role === null ? null : [role]);

    it('resolves an acquirable option to "acquired" when the role/permission is present', () => {
        const option = { acquiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(resolveDoorOptionState({ option, visibility: byRole(RoleEnum.HOST) })).toBe(
            'acquired'
        );
    });

    it('resolves an acquirable option to "unacquired" when the role/permission is absent', () => {
        const option = { acquiredPermission: PermissionEnum.ACCOMMODATION_CREATE };
        expect(resolveDoorOptionState({ option, visibility: byRole(RoleEnum.USER) })).toBe(
            'unacquired'
        );
        expect(resolveDoorOptionState({ option, visibility: byRole(null) })).toBe('unacquired');
    });

    it('resolves a comingSoon option (no acquiredPermission) to "comingSoon", never "acquired"', () => {
        const option = { comingSoon: true };
        expect(resolveDoorOptionState({ option, visibility: byRole(RoleEnum.ADMIN) })).toBe(
            'comingSoon'
        );
        expect(resolveDoorOptionState({ option, visibility: byRole(null) })).toBe('comingSoon');
    });

    it('resolves a plain option with neither acquiredPermission nor comingSoon to "unacquired"', () => {
        expect(resolveDoorOptionState({ option: {}, visibility: byRole(RoleEnum.ADMIN) })).toBe(
            'unacquired'
        );
    });
});

describe('isDoorVisible (HOS-131 §6.3 door lifecycle)', () => {
    const byRole =
        (role: string | null) => (node: { readonly requiredPermission?: PermissionEnum }) =>
            isVisibleByRoles(node, role === null ? null : [role]);
    const byPermissions =
        (permissions: readonly string[]) =>
        (node: { readonly requiredPermission?: PermissionEnum }) =>
            isVisibleByPermissions(node, permissions);

    const listingDoor = {
        options: [
            { id: 'accommodation', acquiredPermission: PermissionEnum.ACCOMMODATION_CREATE },
            { id: 'commerce', acquiredPermission: PermissionEnum.COMMERCE_EDIT_OWN }
        ]
    };

    const partnerDoor = {
        options: [
            { id: 'sponsor', comingSoon: true },
            { id: 'serviceProvider', comingSoon: true }
        ]
    };

    it('shows the listing door when the user has neither acquirable permission', () => {
        expect(isDoorVisible({ door: listingDoor, visibility: byRole(RoleEnum.USER) })).toBe(true);
    });

    it('shows the listing door when the user has exactly one of the two options', () => {
        expect(isDoorVisible({ door: listingDoor, visibility: byRole(RoleEnum.HOST) })).toBe(true);
        expect(
            isDoorVisible({ door: listingDoor, visibility: byRole(RoleEnum.COMMERCE_OWNER) })
        ).toBe(true);
    });

    it('hides the listing door once the user holds BOTH acquirable permissions (spec §6.3)', () => {
        expect(isDoorVisible({ door: listingDoor, visibility: byRole(RoleEnum.ADMIN) })).toBe(
            false
        );
        expect(
            isDoorVisible({
                door: listingDoor,
                visibility: byPermissions([
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.COMMERCE_EDIT_OWN
                ])
            })
        ).toBe(false);
    });

    it('always shows the partner door — both options are comingSoon and can never resolve to acquired', () => {
        expect(isDoorVisible({ door: partnerDoor, visibility: byRole(null) })).toBe(true);
        expect(isDoorVisible({ door: partnerDoor, visibility: byRole(RoleEnum.USER) })).toBe(true);
        expect(isDoorVisible({ door: partnerDoor, visibility: byRole(RoleEnum.ADMIN) })).toBe(true);
        expect(
            isDoorVisible({
                door: partnerDoor,
                visibility: byPermissions(['some.unrelated.permission'])
            })
        ).toBe(true);
    });
});

describe('resolveDoorLabelKey (HOS-134 §5.4 stateful partner-door label)', () => {
    const byRole =
        (role: string | null) => (node: { readonly requiredPermission?: PermissionEnum }) =>
            isVisibleByRoles(node, role === null ? null : [role]);

    const statefulDoor = {
        i18nKey: 'account.doors.partner.title',
        statefulI18nKey: 'account.doors.partner.titleStateful',
        options: [
            { id: 'sponsor', comingSoon: true },
            { id: 'editor', acquiredPermission: PermissionEnum.POST_CREATE }
        ]
    };

    const statelessDoor = {
        i18nKey: 'account.doors.publish.title',
        options: [{ id: 'accommodation', acquiredPermission: PermissionEnum.ACCOMMODATION_CREATE }]
    };

    it('returns the base i18nKey when no option resolves to acquired', () => {
        expect(resolveDoorLabelKey({ door: statefulDoor, visibility: byRole(RoleEnum.USER) })).toBe(
            'account.doors.partner.title'
        );
    });

    it('returns the stateful i18nKey once at least one option resolves to acquired', () => {
        expect(
            resolveDoorLabelKey({ door: statefulDoor, visibility: byRole(RoleEnum.EDITOR) })
        ).toBe('account.doors.partner.titleStateful');
    });

    it('returns the base i18nKey when the door declares no statefulI18nKey, even with an acquired option', () => {
        expect(
            resolveDoorLabelKey({ door: statelessDoor, visibility: byRole(RoleEnum.HOST) })
        ).toBe('account.doors.publish.title');
    });
});
