/**
 * Tests for the account navigation model (HOS-2413 T-017).
 */

import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_MENU_LABEL_KEY,
    buildAccountNavModel,
    getActiveSectionKey
} from '../../src/lib/account-nav-model';

const BASE = { ownsHostTradeListing: false, mcpEnabled: true, activeSection: 'mi-cuenta' } as const;
const groupIds = (model: ReturnType<typeof buildAccountNavModel>) =>
    model.groups.map((entry) => entry.group.id);

describe('buildAccountNavModel: groups per role set', () => {
    it('a tourist-only user sees the account and tourist groups, tourist last', () => {
        const model = buildAccountNavModel({ ...BASE, roles: ['USER'] });
        const ids = groupIds(model);
        expect(ids[0]).toBe('cuenta');
        expect(ids.at(-1)).toBe('turista');
        expect(ids).not.toContain('anfitrion');
        expect(ids).not.toContain('proveedor');
    });

    it('a HOST + VENUE_OWNER sees both management groups, still ending in tourist', () => {
        const model = buildAccountNavModel({ ...BASE, roles: ['HOST', 'VENUE_OWNER'] });
        const ids = groupIds(model);
        expect(ids).toContain('anfitrion');
        expect(ids).toContain('comercio');
        expect(ids.at(-1)).toBe('turista');
    });

    it('the provider group sits right before tourist when the account owns a listing', () => {
        const model = buildAccountNavModel({
            ...BASE,
            roles: ['USER'],
            ownsHostTradeListing: true
        });
        const ids = groupIds(model);
        expect(ids.at(-1)).toBe('turista');
        expect(ids.at(-2)).toBe('proveedor');
    });

    it('a null role set still builds the ungated groups', () => {
        const model = buildAccountNavModel({ ...BASE, roles: null });
        expect(groupIds(model)).toContain('cuenta');
    });
});

describe('buildAccountNavModel: active state', () => {
    it('marks the matching item active and opens its group', () => {
        const model = buildAccountNavModel({
            ...BASE,
            roles: ['USER'],
            activeSection: 'editar'
        });
        const active = model.groups.flatMap((entry) => entry.items).filter((item) => item.active);
        expect(active).toHaveLength(1);
        expect(active[0]?.item.href).toBe('mi-cuenta/editar');
        const group = model.groups.find((entry) => entry.containsActive);
        expect(group?.defaultOpen).toBe(true);
        expect(model.activeLabelKey).toBe(active[0]?.item.i18nKey);
    });

    it('keeps the legacy default (all open but turista) while the shell opens only the active group', () => {
        const model = buildAccountNavModel({
            roles: ['HOST'],
            ownsHostTradeListing: false,
            mcpEnabled: true,
            activeSection: 'editar'
        });
        const turista = model.groups.find((entry) => entry.group.id === 'turista');
        const anfitrion = model.groups.find((entry) => entry.group.id === 'anfitrion');
        expect(anfitrion?.defaultOpen).toBe(true);
        expect(turista?.defaultOpen).toBe(false);
        expect(anfitrion?.shellDefaultOpen).toBe(false);
        expect(model.groups.filter((entry) => entry.shellDefaultOpen)).toHaveLength(1);
    });

    it.each([
        'publica',
        'partner',
        'aliados'
    ])('opens the first headed group in the shell when %s matches no item', (activeSection) => {
        const model = buildAccountNavModel({
            roles: ['HOST'],
            ownsHostTradeListing: false,
            mcpEnabled: true,
            activeSection
        });
        const open = model.groups.filter((entry) => entry.shellDefaultOpen);
        expect(open).toHaveLength(1);
        expect(open[0]).toBe(model.groups.find((entry) => !entry.suppressHeader));
    });

    it('falls back to the generic menu label when nothing is active', () => {
        const model = buildAccountNavModel({
            ...BASE,
            roles: ['USER'],
            activeSection: 'does-not-exist'
        });
        expect(model.activeLabelKey).toBe(ACCOUNT_MENU_LABEL_KEY);
    });

    it('maps the two inbox pages through the section overrides', () => {
        expect(getActiveSectionKey({ href: 'mi-cuenta/consultas' })).toBe('messages');
        expect(getActiveSectionKey({ href: 'mi-cuenta/consultas-propietario' })).toBe(
            'owner-messages'
        );
        expect(getActiveSectionKey({ href: 'mi-cuenta' })).toBe('mi-cuenta');
        expect(getActiveSectionKey({ href: 'mi-cuenta/editar' })).toBe('editar');
    });

    it('lights the guest inbox for activeSection=messages', () => {
        const model = buildAccountNavModel({
            ...BASE,
            roles: ['USER'],
            activeSection: 'messages'
        });
        const active = model.groups.flatMap((entry) => entry.items).find((item) => item.active);
        expect(active?.item.href).toBe('mi-cuenta/consultas');
    });
});

describe('buildAccountNavModel: gated entries', () => {
    it('hides the AI-assistants entry until revealed only when MCP is off', () => {
        const hiddenFlags = (mcpEnabled: boolean) =>
            buildAccountNavModel({ ...BASE, roles: ['USER'], mcpEnabled })
                .groups.flatMap((entry) => entry.items)
                .filter((item) => item.item.id === 'aiAssistants')
                .map((item) => item.hiddenUntilRevealed);
        expect(hiddenFlags(true)).toEqual([false]);
        expect(hiddenFlags(false)).toEqual([true]);
    });

    it('suppresses the header of a single-item cajón group only', () => {
        const model = buildAccountNavModel({
            ...BASE,
            roles: ['USER'],
            ownsHostTradeListing: true
        });
        const provider = model.groups.find((entry) => entry.group.id === 'proveedor');
        expect(provider?.suppressHeader).toBe(true);
        const account = model.groups.find((entry) => entry.group.id === 'cuenta');
        expect(account?.suppressHeader).toBe(false);
    });

    it('returns the discovery doors with a resolved label key', () => {
        const model = buildAccountNavModel({ ...BASE, roles: ['USER'] });
        for (const door of model.doors) {
            expect(door.labelKey).toMatch(/^account\./);
        }
    });
});

describe('buildAccountNavModel: zoned shell (HOS-2551)', () => {
    interface ShellInput {
        readonly roles: readonly string[];
        readonly activeSection: string;
        readonly ownsHostTradeListing?: boolean;
        readonly ownsPartner?: boolean;
        readonly mcpEnabled?: boolean;
    }
    const shellFor = ({
        roles,
        activeSection,
        ownsHostTradeListing = false,
        ownsPartner = false,
        mcpEnabled = true
    }: ShellInput) =>
        buildAccountNavModel({
            roles,
            ownsHostTradeListing,
            ownsPartner,
            mcpEnabled,
            activeSection
        }).shell;
    type Shell = ReturnType<typeof shellFor>;
    const groupIds = (shell: Shell) => shell.groups.map((entry) => entry.group.id);
    const itemIds = (shell: Shell) =>
        shell.groups.flatMap((entry) => entry.items.map((item) => item.item.id));
    const itemsOf = (shell: Shell, id: string) =>
        shell.groups.find((entry) => entry.group.id === id)?.items.map((item) => item.item.id);

    describe('personal zone', () => {
        it('a client sees Inicio, Mi perfil (with AI assistants), Mis viajes and the interim entries', () => {
            const shell = shellFor({ roles: ['HOST'], activeSection: 'editar' });
            expect(shell.mode).toBe('personal');
            expect(groupIds(shell)).toEqual(['inicio', 'perfil', 'turista', 'extras']);
            expect(itemsOf(shell, 'inicio')).toEqual(['dashboard']);
            expect(itemsOf(shell, 'perfil')).toEqual([
                'editProfile',
                'subscription',
                'preferences',
                'newsletter',
                'aiAssistants'
            ]);
            expect(itemsOf(shell, 'turista')).toEqual([
                'favorites',
                'searchHistory',
                'alerts',
                'exclusiveDeals',
                'recommendations',
                'reviews',
                'inbox'
            ]);
            expect(itemsOf(shell, 'extras')).toEqual(['whatsNew', 'help']);
        });

        it('labels the zone groups Inicio, Mi perfil and Mis viajes', () => {
            const shell = shellFor({ roles: ['HOST'], activeSection: 'editar' });
            const keyOf = (id: string) =>
                shell.groups.find((entry) => entry.group.id === id)?.group.i18nKey;
            expect(keyOf('perfil')).toBe('account.nav.groupProfile');
            expect(keyOf('turista')).toBe('account.nav.groupTrips');
            expect(shell.groups[0]?.items[0]?.item.i18nKey).toBe('account.nav.home');
            expect(shell.groups[0]?.suppressHeader).toBe(true);
        });

        it('opens only the group holding the current page and keeps the doors', () => {
            const model = buildAccountNavModel({
                roles: ['HOST'],
                ownsHostTradeListing: false,
                mcpEnabled: true,
                activeSection: 'favoritos'
            });
            const open = model.shell.groups.filter((entry) => entry.shellDefaultOpen);
            expect(open.map((entry) => entry.group.id)).toEqual(['turista']);
            expect(model.shell.doors).toEqual(model.doors);
        });

        it.each([
            'mi-cuenta',
            'editar',
            'suscripcion',
            'preferencias',
            'newsletter',
            'asistentes-ia',
            'novedades',
            'ayuda',
            'favoritos',
            'messages',
            'resenas',
            'publica',
            'aliados'
        ])('treats activeSection=%s as the personal zone', (activeSection) => {
            expect(shellFor({ roles: ['HOST'], activeSection }).mode).toBe('personal');
        });

        it('never lists a business entry', () => {
            const ids = itemIds(
                shellFor({ roles: ['HOST', 'VENUE_OWNER'], activeSection: 'mi-cuenta' })
            );
            expect(ids).not.toContain('properties');
            expect(ids).not.toContain('comercio-listings');
            expect(ids).not.toContain('provider');
        });

        it('keeps the AI-assistants entry hidden until revealed when MCP is off', () => {
            const shell = shellFor({ roles: ['HOST'], activeSection: 'editar', mcpEnabled: false });
            const ai = shell.groups
                .flatMap((entry) => entry.items)
                .find((item) => item.item.id === 'aiAssistants');
            expect(ai?.hiddenUntilRevealed).toBe(true);
        });
    });

    describe('pure tourist', () => {
        it('sees only the personal zone, without AI assistants', () => {
            const shell = shellFor({ roles: ['USER'], activeSection: 'mi-cuenta' });
            expect(shell.mode).toBe('personal');
            expect(itemsOf(shell, 'perfil')).toEqual([
                'editProfile',
                'subscription',
                'preferences',
                'newsletter'
            ]);
            expect(itemIds(shell)).not.toContain('aiAssistants');
        });

        it('does not see AI assistants even on the AI assistants page', () => {
            const shell = shellFor({ roles: ['USER'], activeSection: 'asistentes-ia' });
            expect(itemIds(shell)).not.toContain('aiAssistants');
        });

        it('on a business page sees no vertical at all', () => {
            const shell = shellFor({ roles: ['USER'], activeSection: 'propiedades' });
            expect(shell.mode).toBe('business');
            expect(shell.groups).toEqual([]);
        });
    });

    describe('business zone', () => {
        it.each([
            'host-dashboard',
            'propiedades',
            'owner-messages',
            'promociones',
            'directorio-proveedores',
            'usos-de-beneficio',
            'comercio',
            'publicaciones',
            'eventos',
            'partner',
            'proveedor'
        ])('treats activeSection=%s as the business zone', (activeSection) => {
            expect(shellFor({ roles: ['HOST'], activeSection }).mode).toBe('business');
        });

        it('lists only the verticals the person has, current group open, no doors', () => {
            const shell = shellFor({
                roles: ['HOST', 'VENUE_OWNER', 'EDITOR'],
                activeSection: 'publicaciones',
                ownsHostTradeListing: true
            });
            expect(groupIds(shell)).toEqual(['anfitrion', 'comercio', 'editorial', 'proveedor']);
            expect(
                shell.groups
                    .filter((entry) => entry.shellDefaultOpen)
                    .map((entry) => entry.group.id)
            ).toEqual(['editorial']);
            expect(shell.doors).toEqual([]);
            expect(itemIds(shell)).not.toContain('favorites');
            expect(itemIds(shell)).not.toContain('editProfile');
        });

        it('adds the partner group when the account owns a partner row', () => {
            const model = buildAccountNavModel({
                roles: ['HOST'],
                ownsHostTradeListing: false,
                ownsPartner: true,
                mcpEnabled: true,
                activeSection: 'partner'
            });
            expect(groupIds(model.shell)).toEqual(['anfitrion', 'partner']);
            expect(model.activeLabelKey).toBe('account.nav.partner');
        });

        it('renders a single vertical header-less', () => {
            const shell = shellFor({ roles: ['HOST'], activeSection: 'propiedades' });
            expect(groupIds(shell)).toEqual(['anfitrion']);
            expect(shell.groups[0]?.suppressHeader).toBe(true);
        });

        it('a provider-only account sees its provider entry and counts as a client', () => {
            const business = shellFor({
                roles: ['USER'],
                activeSection: 'proveedor',
                ownsHostTradeListing: true
            });
            expect(itemIds(business)).toEqual(['provider']);
            const personal = shellFor({
                roles: ['USER'],
                activeSection: 'editar',
                ownsHostTradeListing: true
            });
            expect(itemIds(personal)).toContain('aiAssistants');
        });
    });
});
