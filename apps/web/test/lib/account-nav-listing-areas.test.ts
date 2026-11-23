/**
 * Tests for the two listing areas of the business sidebar (HOS-2559):
 * «Comer y salir» (venues) and «Experiencias», each over its own list.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildSidebarView } from '../../src/components/account/ui';
import { BUSINESS_SHORTCUTS } from '../../src/config/account-zones';
import { buildAccountNavModel, getActiveSectionKey } from '../../src/lib/account-nav-model';
import { resolveBusinessShortcuts } from '../../src/lib/business-verticals';
import { buildListingEditorRegistry } from '../../src/lib/editor/listing-editor-registry';
import { ownerListSectionKey } from '../../src/lib/listing/owner-list-vertical';

const VENUE = { roles: ['VENUE_OWNER'], permissions: [PermissionEnum.VENUE_EDIT_OWN] } as const;
const EXPERIENCE = {
    roles: ['EXPERIENCE_OWNER'],
    permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN]
} as const;
const BOTH = {
    roles: ['VENUE_OWNER', 'EXPERIENCE_OWNER'],
    permissions: [PermissionEnum.VENUE_EDIT_OWN, PermissionEnum.EXPERIENCE_EDIT_OWN]
} as const;

const shellFor = ({
    who,
    activeSection
}: {
    readonly who: { readonly roles: readonly string[]; readonly permissions: readonly string[] };
    readonly activeSection: string;
}) =>
    buildAccountNavModel({
        ...who,
        ownsHostTradeListing: false,
        mcpEnabled: false,
        activeSection
    });

const VENUE_KEY = ownerListSectionKey({ vertical: 'venue' });
const EXPERIENCE_KEY = ownerListSectionKey({ vertical: 'experience' });

describe('listing areas: who sees which (HOS-2559)', () => {
    it('a venue-only owner sees only «Comer y salir», header-less, active and open', () => {
        const { shell, activeLabelKey } = shellFor({ who: VENUE, activeSection: VENUE_KEY });
        expect(shell.mode).toBe('business');
        expect(shell.groups.map((entry) => entry.group.id)).toEqual(['comercio-venue']);
        const [venues] = shell.groups;
        expect(venues?.suppressHeader).toBe(true);
        expect(venues?.shellDefaultOpen).toBe(true);
        // HOS-2475: the venue dashboard sits above the list in the same area.
        expect(venues?.items.map((entry) => [entry.item.id, entry.active])).toEqual([
            ['venueDashboard', false],
            ['venue-listings', true]
        ]);
        expect(activeLabelKey).toBe('account.nav.myVenues');
    });

    it('an experience-only owner sees only «Experiencias»', () => {
        const { shell, activeLabelKey } = shellFor({
            who: EXPERIENCE,
            activeSection: EXPERIENCE_KEY
        });
        expect(shell.mode).toBe('business');
        expect(shell.groups.map((entry) => entry.group.id)).toEqual(['comercio-experience']);
        // HOS-2476: the experience dashboard comes first; the list is the active entry.
        expect(shell.groups[0]?.items.map((entry) => [entry.item.id, entry.active])).toEqual([
            ['experienceDashboard', false],
            ['experience-listings', true]
        ]);
        expect(activeLabelKey).toBe('account.nav.myExperiences');
    });

    it('an owner of both sees two titled areas, and only the current one opens', () => {
        const { shell } = shellFor({ who: BOTH, activeSection: EXPERIENCE_KEY });
        expect(
            shell.groups.map((entry) => [
                entry.group.id,
                entry.group.i18nKey,
                entry.suppressHeader,
                entry.containsActive,
                entry.shellDefaultOpen
            ])
        ).toEqual([
            ['comercio-venue', 'account.nav.groupVenues', false, false, false],
            ['comercio-experience', 'account.nav.groupExperiences', false, true, true]
        ]);
    });

    it('renders each area entry with its own list URL', () => {
        const view = buildSidebarView({
            model: shellFor({ who: BOTH, activeSection: VENUE_KEY }),
            locale: 'es'
        });
        const hrefs = JSON.stringify(view);
        expect(hrefs).toContain('/es/mi-cuenta/comercio/?vertical=venue');
        expect(hrefs).toContain('/es/mi-cuenta/comercio/?vertical=experience');
        expect(hrefs).not.toContain('vertical=venue/');
    });
});

describe('listing areas: the editors mark their own area (HOS-2559)', () => {
    it.each([
        ['venue', 'comercio-venue', 'venue-listings'],
        ['experience', 'comercio-experience', 'experience-listings']
    ] as const)('an editor of a %s marks %s active', (vertical, groupId, itemId) => {
        // The editor layout passes getActiveSectionKey(registry.indexPath).
        const registry = buildListingEditorRegistry({ vertical, sectionStates: {} });
        const activeSection = getActiveSectionKey({ href: registry.indexPath });
        expect(activeSection).toBe(ownerListSectionKey({ vertical }));

        const { shell } = shellFor({ who: BOTH, activeSection });
        expect(shell.mode).toBe('business');
        const active = shell.groups.flatMap((entry) =>
            entry.items.filter((item) => item.active).map((item) => [entry.group.id, item.item.id])
        );
        expect(active).toEqual([[groupId, itemId]]);
    });
});

describe('listing areas: user-menu shortcuts point to each list (HOS-2559)', () => {
    it('declares one list per shortcut', () => {
        const targets = Object.fromEntries(
            BUSINESS_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.targets.map((t) => t.href)])
        );
        expect(targets.venues).toEqual(['mi-cuenta/comercio?vertical=venue']);
        expect(targets.experiences).toEqual(['mi-cuenta/comercio?vertical=experience']);
    });

    it('resolves only the shortcut of the vertical the person has', () => {
        const facts = { ownsHostTradeListing: false, ownsPartner: false };
        expect(
            resolveBusinessShortcuts({ ...facts, permissions: EXPERIENCE.permissions }).map(
                (shortcut) => [shortcut.id, shortcut.href]
            )
        ).toEqual([['experiences', 'mi-cuenta/comercio?vertical=experience']]);
        expect(
            resolveBusinessShortcuts({ ...facts, permissions: BOTH.permissions }).map(
                (shortcut) => shortcut.href
            )
        ).toEqual(['mi-cuenta/comercio?vertical=venue', 'mi-cuenta/comercio?vertical=experience']);
    });
});
