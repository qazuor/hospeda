import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DISCOVERY_DOORS } from '../../src/config/discovery-doors';
import { ACCOUNT_NAV_GROUPS, getNavForSurface, type NavGroup } from '../../src/config/navigation';
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
});

describe('ACCOUNT_DISCOVERY_DOORS (config shape, HOS-131 §6.2/§6.3)', () => {
    it('defines exactly the two doors: listing ("Publicá en Hospeda") and partner ("Sumate como aliado")', () => {
        expect(ACCOUNT_DISCOVERY_DOORS.map((door) => door.id)).toEqual(['listing', 'partner']);
        expect(ACCOUNT_DISCOVERY_DOORS.map((door) => door.kind)).toEqual(['listing', 'partner']);
    });

    it('routes each door to its internal hub page (OQ-1)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        expect(listing?.href).toBe('mi-cuenta/publica');
        expect(partner?.href).toBe('mi-cuenta/aliados');
    });

    it('gives the listing door three acquirable options: accommodation, gastronomy, and experience (HOS-134)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        expect(listing?.options.map((option) => option.id)).toEqual([
            'accommodation',
            'gastronomy',
            'experience'
        ]);
    });

    it('gates listing-door options behind ACCOMMODATION_CREATE and COMMERCE_EDIT_OWN (OQ-3: signal = permissions)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        const gastronomy = listing?.options.find((option) => option.id === 'gastronomy');
        const experience = listing?.options.find((option) => option.id === 'experience');
        expect(accommodation?.acquiredPermission).toBe(PermissionEnum.ACCOMMODATION_CREATE);
        expect(gastronomy?.acquiredPermission).toBe(PermissionEnum.COMMERCE_EDIT_OWN);
        expect(experience?.acquiredPermission).toBe(PermissionEnum.COMMERCE_EDIT_OWN);
    });

    it('links the acquired listing-door options to their management pages', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        const gastronomy = listing?.options.find((option) => option.id === 'gastronomy');
        const experience = listing?.options.find((option) => option.id === 'experience');
        expect(accommodation?.manageHref).toBe('mi-cuenta/host-dashboard');
        expect(gastronomy?.manageHref).toBe('mi-cuenta/comercio');
        expect(experience?.manageHref).toBe('mi-cuenta/comercio');
    });

    it('routes gastronomy and experience options to their own lead forms, not a self-service publish flow (HOS-134)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const gastronomy = listing?.options.find((option) => option.id === 'gastronomy');
        const experience = listing?.options.find((option) => option.id === 'experience');
        expect(gastronomy?.href).toBe('publicar-restaurante');
        expect(experience?.href).toBe('publicar-experiencia');
    });

    it('gives the partner door four options: sponsor, partner, serviceProvider, editor (HOS-134)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        expect(partner?.options.map((option) => option.id)).toEqual([
            'sponsor',
            'partner',
            'serviceProvider',
            'editor'
        ]);
    });

    it('routes sponsor, partner, and serviceProvider to their alliance-lead landings with no acquiredPermission (HOS-277 NG-1)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        const leadOptions = partner?.options.filter((option) => option.id !== 'editor') ?? [];
        expect(leadOptions).toHaveLength(3);
        for (const option of leadOptions) {
            expect(option.comingSoon).toBeUndefined();
            expect(option.acquiredPermission).toBeUndefined();
        }
        const sponsor = leadOptions.find((option) => option.id === 'sponsor');
        const partnerOption = leadOptions.find((option) => option.id === 'partner');
        const serviceProvider = leadOptions.find((option) => option.id === 'serviceProvider');
        expect(sponsor?.href).toBe('sumate/sponsor');
        expect(partnerOption?.href).toBe('sumate/partner');
        expect(serviceProvider?.href).toBe('sumate/proveedor');
    });

    it('gives the editor option a real acquired signal (POST_CREATE), no comingSoon, and admin-panel management (HOS-134 D-4)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        const editor = partner?.options.find((option) => option.id === 'editor');
        expect(editor?.acquiredPermission).toBe(PermissionEnum.POST_CREATE);
        expect(editor?.managesInAdminPanel).toBe(true);
        expect(editor?.comingSoon).toBeUndefined();
        expect(editor?.href).toBe('colaborar/editores');
    });

    it('declares the stateful "Sumá otra alianza" key on the partner door, activated once the editor option is acquired (HOS-134)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        expect(partner?.statefulI18nKey).toBe('account.doors.partner.titleStateful');
    });

    it('keeps every door/option label as an i18n key, never resolved text', () => {
        for (const door of ACCOUNT_DISCOVERY_DOORS) {
            expect(door.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            expect(door.subtitleI18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            for (const option of door.options) {
                expect(option.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
                expect(option.descriptionI18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
                expect(option.ctaI18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            }
        }
    });

    it('gives every door and option an @repo/icons component reference, not a string', () => {
        for (const door of ACCOUNT_DISCOVERY_DOORS) {
            expect(typeof door.icon).toBe('function');
            for (const option of door.options) {
                expect(typeof option.icon).toBe('function');
            }
        }
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

    it('returns only the always-curated items (dashboard, favorites, subscription) for the avatar surface', () => {
        const { groups } = getNavForSurface({ surface: 'avatar', visibility: ALLOW_ALL });
        // cuenta -> dashboard + subscription; turista -> favorites. hostDashboard
        // and commerce are picked by priority via pickBusinessShortcut, NOT
        // surface membership, so anfitrion/comercio contribute nothing here.
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
        const cuenta = findGroup(groups, 'cuenta');
        const turista = findGroup(groups, 'turista');
        expect(cuenta?.items.map((item) => item.id)).toEqual(['dashboard', 'subscription']);
        expect(turista?.items.map((item) => item.id)).toEqual(['favorites']);
    });

    it('does not surface hostDashboard/commerce on the avatar surface (business shortcut is priority-picked, not surface-membership-based)', () => {
        const { groups } = getNavForSurface({ surface: 'avatar', visibility: ALLOW_ALL });
        const allIds = groups.flatMap((group) => group.items.map((item) => item.id));
        expect(allIds).not.toContain('hostDashboard');
        expect(allIds).not.toContain('commerce');
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

    it('keeps the avatar surface limited to dashboard/favorites/subscription regardless of business permissions (HOS-131 §6.4)', () => {
        const { groups } = getNavForSurface({
            surface: 'avatar',
            visibility: (node) =>
                isVisibleByPermissions(node, [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.COMMERCE_EDIT_OWN
                ])
        });
        const allIds = groups.flatMap((group) => group.items.map((item) => item.id));
        expect(allIds.sort()).toEqual(['dashboard', 'favorites', 'subscription']);
    });

    it('shows the avatar surface even with zero permissions — those three items have no requiredPermission', () => {
        const { groups } = getNavForSurface({
            surface: 'avatar',
            visibility: (node) => isVisibleByPermissions(node, [])
        });
        const allIds = groups.flatMap((group) => group.items.map((item) => item.id));
        expect(allIds.sort()).toEqual(['dashboard', 'favorites', 'subscription']);
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
