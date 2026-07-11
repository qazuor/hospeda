import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import {
    ACCOUNT_DISCOVERY_DOORS,
    ACCOUNT_NAV_GROUPS,
    getNavForSurface,
    type NavGroup
} from '../../src/config/navigation';
import {
    isVisibleByPermissions,
    isVisibleByRole,
    PERMISSION_ROLE_MAP
} from '../../src/lib/nav-gating';

/** Finds a group in a `getNavForSurface` result by id (assertion helper). */
function findGroup(groups: readonly NavGroup[], id: string): NavGroup | undefined {
    return groups.find((group) => group.id === id);
}

/** Visibility predicate that never filters anything out — used to inspect the raw config. */
const ALLOW_ALL = () => true;

/** Sums the item counts across a list of groups (helper for assertions). */
function totalItems(groups: readonly NavGroup[]): number {
    return groups.reduce((sum, group) => sum + group.items.length, 0);
}

describe('ACCOUNT_NAV_GROUPS (config shape)', () => {
    it('defines the four baseline groups: cuenta, turista, anfitrion, comercio', () => {
        expect(ACCOUNT_NAV_GROUPS.map((group) => group.id)).toEqual([
            'cuenta',
            'turista',
            'anfitrion',
            'comercio'
        ]);
    });

    it('leaves cuenta and turista always-visible (no requiredPermission)', () => {
        const cuenta = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'cuenta');
        const turista = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'turista');
        expect(cuenta?.requiredPermission).toBeUndefined();
        expect(turista?.requiredPermission).toBeUndefined();
    });

    it('gates anfitrion behind ACCOMMODATION_CREATE and comercio behind COMMERCE_EDIT_OWN', () => {
        const anfitrion = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'anfitrion');
        const comercio = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'comercio');
        expect(anfitrion?.requiredPermission).toBe(PermissionEnum.ACCOMMODATION_CREATE);
        expect(comercio?.requiredPermission).toBe(PermissionEnum.COMMERCE_EDIT_OWN);
    });

    it('places "Mis alojamientos" (properties) inside the anfitrion group, not a standalone group (AC-2)', () => {
        const anfitrion = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'anfitrion');
        expect(anfitrion?.items.some((item) => item.id === 'properties')).toBe(true);
    });

    it('marks comercio as suppressHeaderWhenSingle (single-item "cajón" group)', () => {
        const comercio = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'comercio');
        expect(comercio?.suppressHeaderWhenSingle).toBe(true);
        expect(comercio?.items).toHaveLength(1);
    });

    it('stores i18n keys, never resolved text, for every group and item label', () => {
        for (const group of ACCOUNT_NAV_GROUPS) {
            expect(group.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            for (const item of group.items) {
                expect(item.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            }
        }
    });

    it('gives every item an @repo/icons component reference (a function), not a string', () => {
        for (const group of ACCOUNT_NAV_GROUPS) {
            for (const item of group.items) {
                expect(typeof item.icon).toBe('function');
            }
        }
    });

    it('leaves ACCOUNT_DISCOVERY_DOORS empty pending HOS-131 T-011 (OQ-1/OQ-3)', () => {
        expect(ACCOUNT_DISCOVERY_DOORS).toEqual([]);
    });
});

describe('PERMISSION_ROLE_MAP exhaustiveness (regression guard)', () => {
    it('has a defined entry for every requiredPermission declared across ACCOUNT_NAV_GROUPS (groups AND items)', () => {
        const declaredPermissions = new Set<PermissionEnum>();
        for (const group of ACCOUNT_NAV_GROUPS) {
            if (group.requiredPermission) {
                declaredPermissions.add(group.requiredPermission);
            }
            for (const item of group.items) {
                if (item.requiredPermission) {
                    declaredPermissions.add(item.requiredPermission);
                }
            }
        }

        // Sanity check: fail loudly if the config itself stops declaring any
        // gated permission (would make this test vacuously true).
        expect(declaredPermissions.size).toBeGreaterThan(0);

        const missingMapEntries = [...declaredPermissions].filter(
            (permission) => PERMISSION_ROLE_MAP[permission] === undefined
        );

        // A missing entry silently makes isVisibleByRole() return false for
        // EVERY role (including admin) on that group/item — this must fail
        // loudly the moment a future gated group (e.g. T-011 Aliados) adds a
        // requiredPermission without a matching PERMISSION_ROLE_MAP entry.
        expect(missingMapEntries).toEqual([]);
    });
});

describe('getNavForSurface (selector)', () => {
    it('returns every group/item for the sidebar surface with an allow-all predicate', () => {
        const { groups } = getNavForSurface({ surface: 'sidebar', visibility: ALLOW_ALL });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'turista',
            'anfitrion',
            'comercio'
        ]);
        expect(totalItems(groups)).toBe(totalItems(ACCOUNT_NAV_GROUPS));
    });

    it('returns every group/item for the mobile surface with an allow-all predicate', () => {
        const { groups } = getNavForSurface({ surface: 'mobile', visibility: ALLOW_ALL });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'turista',
            'anfitrion',
            'comercio'
        ]);
    });

    it('returns nothing for the avatar surface — curation is deferred to a later HOS-131 task', () => {
        const { groups } = getNavForSurface({ surface: 'avatar', visibility: ALLOW_ALL });
        expect(groups).toEqual([]);
    });

    it('drops a group entirely once all of its items are filtered out by visibility', () => {
        const denyAll = () => false;
        const { groups } = getNavForSurface({ surface: 'sidebar', visibility: denyAll });
        expect(groups).toEqual([]);
    });
});

describe('getNavForSurface + isVisibleByPermissions (client gating, exact)', () => {
    it('shows only cuenta + turista when the user has no relevant permission', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByPermissions(node, [])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
    });

    it('adds anfitrion (with its "properties" item, AC-2) when the user has ACCOMMODATION_CREATE', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) =>
                isVisibleByPermissions(node, [PermissionEnum.ACCOMMODATION_CREATE])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista', 'anfitrion']);
        const anfitrion = findGroup(groups, 'anfitrion');
        expect(anfitrion?.items.map((item) => item.id)).toEqual([
            'hostDashboard',
            'properties',
            'ownerMessages',
            'promotions',
            'providerDirectory'
        ]);
    });

    it('adds comercio (with its "commerce" item) when the user has COMMERCE_EDIT_OWN', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByPermissions(node, [PermissionEnum.COMMERCE_EDIT_OWN])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista', 'comercio']);
        const comercio = findGroup(groups, 'comercio');
        expect(comercio?.items.map((item) => item.id)).toEqual(['commerce']);
    });

    it('shows all four groups when the user has both business permissions', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) =>
                isVisibleByPermissions(node, [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.COMMERCE_EDIT_OWN
                ])
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'turista',
            'anfitrion',
            'comercio'
        ]);
    });
});

describe('getNavForSurface + isVisibleByRole (server SSR gating, approximate)', () => {
    it('shows only cuenta + turista for an unauthenticated visitor (role = null)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRole(node, null)
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
    });

    it('shows only cuenta + turista for a plain tourist USER role', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRole(node, RoleEnum.USER)
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
    });

    it('adds anfitrion (with its "properties" item, AC-2) for a HOST role', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRole(node, RoleEnum.HOST)
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista', 'anfitrion']);
        const anfitrion = findGroup(groups, 'anfitrion');
        expect(anfitrion?.items.some((item) => item.id === 'properties')).toBe(true);
    });

    it('adds comercio (with its "commerce" item) for a COMMERCE_OWNER role', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRole(node, RoleEnum.COMMERCE_OWNER)
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista', 'comercio']);
        const comercio = findGroup(groups, 'comercio');
        expect(comercio?.items.map((item) => item.id)).toEqual(['commerce']);
    });

    it('adds both anfitrion and comercio for platform staff (ADMIN)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRole(node, RoleEnum.ADMIN)
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'turista',
            'anfitrion',
            'comercio'
        ]);
    });
});
