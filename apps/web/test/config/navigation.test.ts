/**
 * @file navigation.test.ts
 * @description Shape of the account navigation config: the nav groups, the
 * discovery doors and the permission-to-role map they gate on. The gating
 * behaviour of `getNavForSurface` lives in `navigation-gating.test.ts`.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DISCOVERY_DOORS } from '../../src/config/discovery-doors';
import { ACCOUNT_NAV_GROUPS } from '../../src/config/navigation';
import { PERMISSION_ROLE_MAP } from '../../src/lib/nav-gating';

describe('ACCOUNT_NAV_GROUPS (config shape)', () => {
    it('defines the baseline groups with turista last (HOS-2124, HOS-2559): cuenta, anfitrion, comercio-venue, comercio-experience, editorial, turista', () => {
        expect(ACCOUNT_NAV_GROUPS.map((group) => group.id)).toEqual([
            'cuenta',
            'anfitrion',
            'comercio-venue',
            'comercio-experience',
            'editorial',
            'turista'
        ]);
    });

    it('leaves cuenta and turista always-visible (no requiredPermission)', () => {
        const cuenta = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'cuenta');
        const turista = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'turista');
        expect(cuenta?.requiredPermission).toBeUndefined();
        expect(turista?.requiredPermission).toBeUndefined();
    });

    it('gates anfitrion behind ACCOMMODATION_CREATE and each listing area behind its own vertical permission (HOS-2559)', () => {
        const anfitrion = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'anfitrion');
        const venues = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'comercio-venue');
        const experiences = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'comercio-experience');
        expect(anfitrion?.requiredPermission).toBe(PermissionEnum.ACCOMMODATION_CREATE);
        expect(venues?.requiredPermission).toBe(PermissionEnum.VENUE_EDIT_OWN);
        expect(experiences?.requiredPermission).toBe(PermissionEnum.EXPERIENCE_EDIT_OWN);
        expect(venues?.requiredPermissions).toBeUndefined();
        expect(experiences?.requiredPermissions).toBeUndefined();
    });

    it('places "Mis alojamientos" (properties) inside the anfitrion group, not a standalone group (AC-2)', () => {
        const anfitrion = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'anfitrion');
        expect(anfitrion?.items.some((item) => item.id === 'properties')).toBe(true);
    });

    it('gives each listing area a titled header over one list entry (HOS-2559)', () => {
        const venues = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'comercio-venue');
        const experiences = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'comercio-experience');
        expect(venues?.suppressHeaderWhenSingle).toBeUndefined();
        expect(experiences?.suppressHeaderWhenSingle).toBeUndefined();
        expect(venues?.i18nKey).toBe('account.nav.groupVenues');
        expect(experiences?.i18nKey).toBe('account.nav.groupExperiences');
        expect(venues?.items.map((item) => [item.id, item.href])).toEqual([
            ['venueDashboard', 'mi-cuenta/tablero-locales'],
            ['venue-listings', 'mi-cuenta/comercio?vertical=venue']
        ]);
        expect(experiences?.items.map((item) => [item.id, item.href])).toEqual([
            ['experienceDashboard', 'mi-cuenta/tablero-experiencias'],
            ['experience-listings', 'mi-cuenta/comercio?vertical=experience']
        ]);
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

    it('gives the listing door three acquirable options: accommodation, venue, and experience (HOS-134)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        expect(listing?.options.map((option) => option.id)).toEqual([
            'accommodation',
            'venue',
            'experience'
        ]);
    });

    it('gates listing-door options behind ACCOMMODATION_CREATE and VENUE_EDIT_OWN (OQ-3: signal = permissions)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        const venue = listing?.options.find((option) => option.id === 'venue');
        const experience = listing?.options.find((option) => option.id === 'experience');
        expect(accommodation?.acquiredPermission).toBe(PermissionEnum.ACCOMMODATION_CREATE);
        expect(venue?.acquiredPermission).toBe(PermissionEnum.VENUE_EDIT_OWN);
        expect(experience?.acquiredPermission).toBe(PermissionEnum.EXPERIENCE_EDIT_OWN);
    });

    it('links the acquired listing-door options to their management pages', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        const venue = listing?.options.find((option) => option.id === 'venue');
        const experience = listing?.options.find((option) => option.id === 'experience');
        expect(accommodation?.manageHref).toBe('mi-cuenta/host-dashboard');
        expect(venue?.manageHref).toBe('mi-cuenta/comercio?vertical=venue');
        expect(experience?.manageHref).toBe('mi-cuenta/comercio?vertical=experience');
    });

    it('routes every listing-door option at ITS OWN publish page (HOS-1156 AC-1)', () => {
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        const venue = listing?.options.find((option) => option.id === 'venue');
        const experience = listing?.options.find((option) => option.id === 'experience');

        // This case used to assert the opposite — that the two venue/experience options
        // led AWAY from a self-service publish flow — and that reading survived
        // one URL rename too many. HOS-1032 repointed both at the 301 target of
        // the URL they used to name, and the target was a SALES page, so the
        // "Publicar" button stopped leading to publishing. That is the defect
        // HOS-1156 fixes; this is the same case, inverted.
        expect(accommodation?.href).toBe('publicar');
        expect(venue?.href).toBe('publicar/comer-y-salir');
        expect(experience?.href).toBe('publicar/experiencias');

        // Each vertical still goes to its OWN page — the property the previous
        // version of this case was really protecting.
        const hrefs = [accommodation?.href, venue?.href, experience?.href];
        expect(new Set(hrefs).size).toBe(3);
    });

    it('leaves manageHref and acquiredPermission untouched by the repoint (AC-3)', () => {
        // The repoint moved `href` and nothing else: `manageHref` is where an
        // owner goes once they HAVE a listing, which this spec did not change.
        const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        const venue = listing?.options.find((option) => option.id === 'venue');
        const experience = listing?.options.find((option) => option.id === 'experience');

        expect(accommodation?.manageHref).toBe('mi-cuenta/host-dashboard');
        // HOS-2559 later pointed each one at its own list.
        expect(venue?.manageHref).toBe('mi-cuenta/comercio?vertical=venue');
        expect(experience?.manageHref).toBe('mi-cuenta/comercio?vertical=experience');
        expect(accommodation?.acquiredPermission).toBe(PermissionEnum.ACCOMMODATION_CREATE);
        expect(venue?.acquiredPermission).toBe(PermissionEnum.VENUE_EDIT_OWN);
        expect(experience?.acquiredPermission).toBe(PermissionEnum.EXPERIENCE_EDIT_OWN);
    });

    it('gives the partner door four options: sponsor, partner, serviceProvider, editor (HOS-134)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        expect(partner?.options.map((option) => option.id)).toEqual([
            'sponsor',
            'partner',
            'serviceProvider',
            'editorPosts',
            'editorEvents'
        ]);
    });

    it('routes sponsor, partner, and serviceProvider to their alliance-lead landings with no acquiredPermission (HOS-277 NG-1)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        const leadOptions =
            partner?.options.filter((option) => !option.id.startsWith('editor')) ?? [];
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

    // HOS-374 OQ-5 split the single `editor` option in two, one per content
    // type, and moved management OFF the admin panel: Phase 3 (§7.6.6) closes
    // the panel to editors, so a `managesInAdminPanel` "Gestionar" button would
    // point at a door they can no longer open.
    it('gives each editor option a real acquired signal, no comingSoon, and /mi-cuenta management (HOS-374 OQ-5)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');

        const editorPosts = partner?.options.find((option) => option.id === 'editorPosts');
        expect(editorPosts?.acquiredPermission).toBe(PermissionEnum.POST_CREATE);
        expect(editorPosts?.manageHref).toBe('mi-cuenta/publicaciones');
        expect(editorPosts?.comingSoon).toBeUndefined();
        expect(editorPosts?.href).toBe('colaborar/editores');

        const editorEvents = partner?.options.find((option) => option.id === 'editorEvents');
        // EVENT_CREATE, not POST_CREATE: keyed to the capability the option
        // actually manages, so a future split between the two permissions
        // cannot show an editor a listing they cannot write to.
        expect(editorEvents?.acquiredPermission).toBe(PermissionEnum.EVENT_CREATE);
        expect(editorEvents?.manageHref).toBe('mi-cuenta/eventos');
        expect(editorEvents?.comingSoon).toBeUndefined();
        expect(editorEvents?.href).toBe('colaborar/editores');
    });

    it('never sends an acquired editor to the admin panel (HOS-374 Phase 3 closes it to them)', () => {
        const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');
        for (const option of partner?.options ?? []) {
            if (option.id.startsWith('editor')) {
                expect(option.managesInAdminPanel).toBeUndefined();
            }
        }
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
            for (const permission of group.requiredPermissions ?? []) {
                declaredPermissions.add(permission);
            }
            for (const item of group.items) {
                if (item.requiredPermission) {
                    declaredPermissions.add(item.requiredPermission);
                }
                for (const permission of item.requiredPermissions ?? []) {
                    declaredPermissions.add(permission);
                }
            }
        }

        // Sanity check: fail loudly if the config itself stops declaring any
        // gated permission (would make this test vacuously true).
        expect(declaredPermissions.size).toBeGreaterThan(0);

        const missingMapEntries = [...declaredPermissions].filter(
            (permission) => PERMISSION_ROLE_MAP[permission] === undefined
        );

        // A missing entry silently makes isVisibleByRoles() return false for
        // EVERY role (including admin) on that group/item — this must fail
        // loudly the moment a future gated group (e.g. T-011 Aliados) adds a
        // requiredPermission without a matching PERMISSION_ROLE_MAP entry.
        expect(missingMapEntries).toEqual([]);
    });
});
