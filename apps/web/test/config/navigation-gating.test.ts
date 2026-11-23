/**
 * @file navigation-gating.test.ts
 * @description `getNavForSurface` and the two visibility predicates: which
 * groups and items each permission set (client, exact) or role set (server
 * SSR, approximate) sees, plus the help entry. Split from `navigation.test.ts`
 * (config shape) to keep both files under 500 lines.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_NAV_GROUPS, getNavForSurface, type NavGroup } from '../../src/config/navigation';
import { isVisibleByPermissions, isVisibleByRoles } from '../../src/lib/nav-gating';

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

describe('getNavForSurface (selector)', () => {
    it('returns every group/item for the sidebar surface with an allow-all predicate', () => {
        const { groups } = getNavForSurface({ surface: 'sidebar', visibility: ALLOW_ALL });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'anfitrion',
            'comercio-venue',
            'comercio-experience',
            'editorial',
            'turista'
        ]);
        expect(totalItems(groups)).toBe(totalItems(ACCOUNT_NAV_GROUPS));
    });

    it('returns every group/item for the mobile surface with an allow-all predicate', () => {
        const { groups } = getNavForSurface({ surface: 'mobile', visibility: ALLOW_ALL });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'anfitrion',
            'comercio-venue',
            'comercio-experience',
            'editorial',
            'turista'
        ]);
    });

    it('returns only the always-curated items (dashboard, favorites, subscription) for the avatar surface', () => {
        const { groups } = getNavForSurface({ surface: 'avatar', visibility: ALLOW_ALL });
        // cuenta -> dashboard + subscription; turista -> favorites. hostDashboard
        // and venue/experience come from BUSINESS_SHORTCUTS (HOS-2551), NOT
        // surface membership, so the business groups contribute nothing here.
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
        const cuenta = findGroup(groups, 'cuenta');
        const turista = findGroup(groups, 'turista');
        expect(cuenta?.items.map((item) => item.id)).toEqual(['dashboard', 'subscription']);
        expect(turista?.items.map((item) => item.id)).toEqual(['favorites']);
    });

    it('does not surface hostDashboard or the listing entries on the avatar surface (business shortcut is priority-picked, not surface-membership-based)', () => {
        const { groups } = getNavForSurface({ surface: 'avatar', visibility: ALLOW_ALL });
        const allIds = groups.flatMap((group) => group.items.map((item) => item.id));
        expect(allIds).not.toContain('hostDashboard');
        expect(allIds).not.toContain('venue-listings');
        expect(allIds).not.toContain('experience-listings');
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
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'anfitrion', 'turista']);
        const anfitrion = findGroup(groups, 'anfitrion');
        expect(anfitrion?.items.map((item) => item.id)).toEqual([
            'hostDashboard',
            'properties',
            'ownerMessages',
            'promotions',
            'providerDirectory',
            'benefitUsages'
        ]);
    });

    it('adds only «Comer y salir» when the user has VENUE_EDIT_OWN (HOS-2559)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByPermissions(node, [PermissionEnum.VENUE_EDIT_OWN])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'comercio-venue', 'turista']);
        const venues = findGroup(groups, 'comercio-venue');
        expect(venues?.items.map((item) => item.id)).toEqual(['venueDashboard', 'venue-listings']);
    });

    it('adds only «Experiencias» with only the experience permission (HOS-2559)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByPermissions(node, [PermissionEnum.EXPERIENCE_EDIT_OWN])
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'comercio-experience',
            'turista'
        ]);
        const experiences = findGroup(groups, 'comercio-experience');
        expect(experiences?.items.map((item) => item.id)).toEqual([
            'experienceDashboard',
            'experience-listings'
        ]);
    });

    it('shows all four groups when the user has both business permissions', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) =>
                isVisibleByPermissions(node, [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.VENUE_EDIT_OWN
                ])
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'anfitrion',
            'comercio-venue',
            'turista'
        ]);
    });

    it('keeps the avatar surface limited to dashboard/favorites/subscription regardless of business permissions (HOS-131 §6.4)', () => {
        const { groups } = getNavForSurface({
            surface: 'avatar',
            visibility: (node) =>
                isVisibleByPermissions(node, [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.VENUE_EDIT_OWN
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

describe('getNavForSurface + isVisibleByRoles (server SSR gating, approximate)', () => {
    it('shows only cuenta + turista for an unauthenticated visitor (role = null)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, null)
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
    });

    it('shows only cuenta + turista for a plain tourist USER role', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.USER])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'turista']);
    });

    it('adds anfitrion (with its "properties" item, AC-2) for a HOST role', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.HOST])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'anfitrion', 'turista']);
        const anfitrion = findGroup(groups, 'anfitrion');
        expect(anfitrion?.items.some((item) => item.id === 'properties')).toBe(true);
    });

    it('adds only «Comer y salir» for a VENUE_OWNER role (HOS-2559)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.VENUE_OWNER])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'comercio-venue', 'turista']);
        const venues = findGroup(groups, 'comercio-venue');
        expect(venues?.items.map((item) => item.id)).toEqual(['venueDashboard', 'venue-listings']);
    });

    it('adds only «Experiencias» for an EXPERIENCE_OWNER role (HOS-2559)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.EXPERIENCE_OWNER])
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'comercio-experience',
            'turista'
        ]);
        const experiences = findGroup(groups, 'comercio-experience');
        expect(experiences?.items.map((item) => item.id)).toEqual([
            'experienceDashboard',
            'experience-listings'
        ]);
    });

    it('adds anfitrion, both listing areas and editorial for platform staff (ADMIN)', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.ADMIN])
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'anfitrion',
            'comercio-venue',
            'comercio-experience',
            'editorial',
            'turista'
        ]);
    });

    it('gives an EDITOR the editorial group with both own-content listings', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.EDITOR])
        });
        const editorial = findGroup(groups, 'editorial');
        expect(editorial?.items.map((item) => item.id)).toEqual(['myPosts', 'myEvents']);
        expect(editorial?.items.map((item) => item.href)).toEqual([
            'mi-cuenta/publicaciones',
            'mi-cuenta/eventos'
        ]);
    });

    it('does NOT give an EDITOR the anfitrion group (an editor is not a host)', () => {
        // Regression: the SSR map listed EDITOR under ACCOMMODATION_CREATE, so
        // the sidebar offered "Mis alojamientos", the host dashboard and the
        // owner inbox to an account the seed never grants ACCOMMODATION_CREATE
        // to. Worse, it disagreed with the avatar dropdown, which evaluates the
        // REAL permission strings and always hid them.
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.EDITOR])
        });
        expect(groups.map((group) => group.id)).toEqual(['cuenta', 'editorial', 'turista']);
    });

    it('keeps the host group for someone holding BOTH the HOST and EDITOR hats', () => {
        // HOS-296: hats accumulate. Removing EDITOR from the accommodation set
        // must not cost a host who also edits content their host area.
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.HOST, RoleEnum.EDITOR])
        });
        expect(groups.map((group) => group.id)).toEqual([
            'cuenta',
            'anfitrion',
            'editorial',
            'turista'
        ]);
    });

    it('drops the editorial group entirely for a plain tourist', () => {
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.USER])
        });
        expect(findGroup(groups, 'editorial')).toBeUndefined();
    });

    it('surfaces only the entitled half when posts and events diverge', () => {
        // The editorial group carries NO group-level requiredPermission on
        // purpose: POST_CREATE and EVENT_CREATE are separate permissions kept
        // as separate map entries so they MAY diverge. Gating the group on
        // either one would hide the other's item the day they do. This asserts
        // the half-entitled case directly, since no role produces it today.
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByPermissions(node, [PermissionEnum.EVENT_CREATE])
        });
        const editorial = findGroup(groups, 'editorial');
        expect(editorial?.items.map((item) => item.id)).toEqual(['myEvents']);
    });
});

describe('help entry (HOS-2410 web-ui §5, AC-23)', () => {
    it('sits in the cuenta group right after whatsNew, ungated, on sidebar and mobile', () => {
        // Arrange
        const cuenta = findGroup(ACCOUNT_NAV_GROUPS, 'cuenta');
        const ids = cuenta?.items.map((item) => item.id) ?? [];
        const help = cuenta?.items.find((item) => item.id === 'help');

        // Assert
        expect(ids.indexOf('help')).toBe(ids.indexOf('whatsNew') + 1);
        expect(help?.href).toBe('mi-cuenta/ayuda');
        expect(help?.i18nKey).toBe('account.nav.help');
        expect(help?.requiredPermission).toBeUndefined();
        expect(help?.surfaces).toEqual(expect.arrayContaining(['sidebar', 'mobile']));
    });

    it('is shown to a user with no role-gated access at all', () => {
        // Act
        const { groups } = getNavForSurface({
            surface: 'sidebar',
            visibility: (node) => isVisibleByRoles(node, [RoleEnum.USER])
        });

        // Assert
        expect(findGroup(groups, 'cuenta')?.items.some((item) => item.id === 'help')).toBe(true);
    });
});
