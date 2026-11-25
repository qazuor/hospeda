import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildAccountNavModel } from '../../src/lib/account-nav-model';
import { getActiveSectionKey } from '../../src/lib/account-nav-section';
import { buildFullAccountMenu } from '../../src/lib/account-nav-shell';

const base = {
    roles: null,
    permissions: [],
    ownsHostTradeListing: false,
    ownsPartner: false,
    mcpEnabled: false,
    activeSection: 'mi-cuenta'
} as const;

describe('full account menu and zone links', () => {
    it('retains publisher eligibility even when desktop shortcut eligibility is narrower', () => {
        const input = {
            ...base,
            permissions: [PermissionEnum.POST_UPDATE, PermissionEnum.VENUE_EDIT_ALL]
        };
        const model = buildAccountNavModel(input);
        const full = buildFullAccountMenu({ ...input, groups: model.groups, doors: model.doors });
        expect(full.groups.map((entry) => entry.group.id)).toEqual([
            'inicio',
            'comercio-venue',
            'editorial',
            'perfil',
            'turista'
        ]);
        expect(
            full.groups
                .flatMap((entry) => entry.items)
                .some((entry) => entry.item.id === 'aiAssistants')
        ).toBe(false);
    });
    it('normalizes browser pathnames before resolving the active entry', () => {
        expect(getActiveSectionKey({ href: '/es/mi-cuenta/' })).toBe('mi-cuenta');
        expect(getActiveSectionKey({ href: '/pt/mi-cuenta/consultas/' })).toBe('messages');
        expect(getActiveSectionKey({ href: '/en/mi-cuenta/editar/' })).toBe('editar');
    });
    it('keeps every business vertical and ownership-only group in catalog order', () => {
        const input = {
            ...base,
            permissions: [
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.VENUE_EDIT_OWN,
                PermissionEnum.EXPERIENCE_EDIT_OWN,
                PermissionEnum.POST_CREATE
            ],
            ownsPartner: true,
            ownsHostTradeListing: true
        };
        const model = buildAccountNavModel(input);
        const full = buildFullAccountMenu({ ...input, groups: model.groups, doors: model.doors });
        expect(full.groups.map((entry) => entry.group.id)).toEqual([
            'inicio',
            'anfitrion',
            'comercio-venue',
            'comercio-experience',
            'editorial',
            'partner',
            'proveedor',
            'perfil',
            'turista'
        ]);
    });
    it.each([
        [[], [], ['inicio', 'perfil', 'turista']],
        [
            [PermissionEnum.ACCOMMODATION_CREATE],
            ['anfitrion'],
            ['inicio', 'anfitrion', 'perfil', 'turista']
        ],
        [
            [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.VENUE_EDIT_OWN],
            ['anfitrion', 'comercio-venue'],
            ['inicio', 'anfitrion', 'comercio-venue', 'perfil', 'turista']
        ],
        [[PermissionEnum.POST_CREATE], ['editorial'], ['inicio', 'editorial', 'perfil', 'turista']]
    ])('composes the full menu for permissions %j', (permissions, verticals, expected) => {
        const input = { ...base, permissions };
        const model = buildAccountNavModel(input);
        const full = buildFullAccountMenu({ ...input, groups: model.groups, doors: model.doors });
        expect(full.groups.map((entry) => entry.group.id)).toEqual(expected);
        expect(model.shell.zoneLinks.map((link) => link.id)).toEqual(verticals);
        expect(full.doors).toEqual(model.doors);
    });

    it('keeps ownership-only groups in catalog order and one business return link', () => {
        const input = {
            ...base,
            ownsPartner: true,
            ownsHostTradeListing: true,
            activeSection: 'proveedor'
        };
        const model = buildAccountNavModel(input);
        const full = buildFullAccountMenu({ ...input, groups: model.groups, doors: model.doors });
        expect(full.groups.map((entry) => entry.group.id)).toEqual([
            'inicio',
            'partner',
            'proveedor',
            'perfil',
            'turista'
        ]);
        expect(model.shell.zoneLinks).toEqual([
            { id: 'account', href: 'mi-cuenta', i18nKey: 'account.title', direction: 'back' }
        ]);
    });

    it.each([
        [true, [], false, false],
        [false, [PermissionEnum.ACCOMMODATION_CREATE], false, false],
        [true, [PermissionEnum.ACCOMMODATION_CREATE], false, true],
        [true, [], true, true],
        [true, [PermissionEnum.POST_CREATE], false, true]
    ])('preserves the shared MCP real-client gate (%j, %j, %j)', (mcpEnabled, permissions, ownsPartner, expected) => {
        const input = { ...base, mcpEnabled, permissions, ownsPartner };
        const model = buildAccountNavModel(input);
        const full = buildFullAccountMenu({ ...input, groups: model.groups, doors: model.doors });
        expect(
            full.groups
                .flatMap((entry) => entry.items)
                .some((entry) => entry.item.id === 'aiAssistants')
        ).toBe(expected);
    });
});

describe('zone link copy and lone-vertical headers (HOS-2622 review)', () => {
    it('names each vertical with its own full phrase in the personal zone', () => {
        // Arrange
        const input = {
            ...base,
            permissions: [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.VENUE_EDIT_OWN]
        };
        // Act
        const model = buildAccountNavModel(input);
        // Assert
        expect(model.shell.zoneLinks.map((link) => link.i18nKey)).toEqual([
            'account.nav.zoneLink.host',
            'account.nav.zoneLink.venues'
        ]);
    });

    it('keeps the header of a lone business vertical inside the full sheet', () => {
        // Arrange
        const input = { ...base, permissions: [PermissionEnum.ACCOMMODATION_CREATE] };
        const model = buildAccountNavModel(input);
        // Act
        const full = buildFullAccountMenu({ ...input, groups: model.groups, doors: model.doors });
        // Assert
        const host = full.groups.find((entry) => entry.group.id === 'anfitrion');
        expect(host?.suppressHeader).toBe(false);
    });
});
