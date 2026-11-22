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

describe('buildAccountNavModel: shell split (HOS-2551)', () => {
    const shellFor = (
        roles: readonly string[],
        activeSection: string,
        ownsHostTradeListing = false
    ) =>
        buildAccountNavModel({ roles, ownsHostTradeListing, mcpEnabled: true, activeSection })
            .shell;
    const shellGroupIds = (shell: ReturnType<typeof shellFor>) =>
        shell.groups.map((entry) => entry.group.id);
    const shellItemIds = (shell: ReturnType<typeof shellFor>) =>
        shell.groups.flatMap((entry) => entry.items.map((item) => item.item.id));

    describe('personal page', () => {
        it('lists only the personal entries, in order, as one header-less open group', () => {
            const shell = shellFor(['HOST', 'VENUE_OWNER'], 'editar');
            expect(shell.mode).toBe('personal');
            expect(shell.groups).toHaveLength(1);
            expect(shell.groups[0]?.suppressHeader).toBe(true);
            expect(shell.groups[0]?.shellDefaultOpen).toBe(true);
            expect(shellItemIds(shell)).toEqual([
                'editProfile',
                'subscription',
                'preferences',
                'newsletter',
                'aiAssistants',
                'whatsNew',
                'help'
            ]);
        });

        it('marks the current entry active and shows no discovery door', () => {
            const shell = shellFor(['USER'], 'preferencias');
            const active = shell.groups
                .flatMap((entry) => entry.items)
                .filter((item) => item.active);
            expect(active.map((item) => item.item.id)).toEqual(['preferences']);
            expect(shell.doors).toEqual([]);
        });

        it('never lists the areas home or an area entry', () => {
            const ids = shellItemIds(shellFor(['HOST'], 'editar'));
            expect(ids).not.toContain('dashboard');
            expect(ids).not.toContain('properties');
            expect(ids).not.toContain('favorites');
        });

        it.each([
            'editar',
            'suscripcion',
            'preferencias',
            'newsletter',
            'asistentes-ia',
            'novedades',
            'ayuda'
        ])('treats activeSection=%s as a personal page', (activeSection) => {
            expect(shellFor(['USER'], activeSection).mode).toBe('personal');
        });

        it('keeps the AI-assistants entry hidden until revealed when MCP is off', () => {
            const shell = buildAccountNavModel({
                roles: ['USER'],
                ownsHostTradeListing: false,
                mcpEnabled: false,
                activeSection: 'editar'
            }).shell;
            const ai = shell.groups
                .flatMap((entry) => entry.items)
                .find((item) => item.item.id === 'aiAssistants');
            expect(ai?.hiddenUntilRevealed).toBe(true);
        });
    });

    describe('area page', () => {
        it('lists only the areas the person has, with the current group open', () => {
            const shell = shellFor(['HOST', 'VENUE_OWNER'], 'propiedades');
            expect(shell.mode).toBe('areas');
            expect(shellGroupIds(shell)).toEqual(['anfitrion', 'comercio', 'turista']);
            const open = shell.groups.filter((entry) => entry.shellDefaultOpen);
            expect(open.map((entry) => entry.group.id)).toEqual(['anfitrion']);
            expect(shell.groups.find((entry) => entry.group.id === 'turista')?.suppressHeader).toBe(
                false
            );
        });

        it('lists no personal entry', () => {
            const ids = shellItemIds(shellFor(['HOST'], 'favoritos'));
            expect(ids).not.toContain('editProfile');
            expect(ids).not.toContain('whatsNew');
            expect(ids).not.toContain('help');
        });

        it('treats the areas home /mi-cuenta/ as an area page and opens the first headed area', () => {
            const shell = shellFor(['HOST'], 'mi-cuenta');
            expect(shell.mode).toBe('areas');
            expect(shellItemIds(shell)).not.toContain('dashboard');
            const open = shell.groups.filter((entry) => entry.shellDefaultOpen);
            expect(open.map((entry) => entry.group.id)).toEqual(['anfitrion']);
        });

        it('keeps the discovery doors with the areas', () => {
            const model = buildAccountNavModel({
                roles: ['USER'],
                ownsHostTradeListing: false,
                mcpEnabled: true,
                activeSection: 'mi-cuenta'
            });
            expect(model.shell.doors).toEqual(model.doors);
        });

        it('leaves the legacy groups untouched (cuenta still first)', () => {
            const model = buildAccountNavModel({
                roles: ['HOST'],
                ownsHostTradeListing: false,
                mcpEnabled: true,
                activeSection: 'propiedades'
            });
            expect(model.groups[0]?.group.id).toBe('cuenta');
        });
    });

    describe('single-area account', () => {
        it.each([
            'mi-cuenta',
            'favoritos'
        ])('a pure tourist on %s sees the tourist items as a flat list', (activeSection) => {
            const shell = shellFor(['USER'], activeSection);
            expect(shell.mode).toBe('areas');
            expect(shellGroupIds(shell)).toEqual(['turista']);
            expect(shell.groups[0]?.suppressHeader).toBe(true);
            expect(shellItemIds(shell)).toContain('favorites');
        });

        it('a tourist who also owns a provider listing has two areas, tourist headed', () => {
            const shell = shellFor(['USER'], 'favoritos', true);
            expect(shellGroupIds(shell)).toEqual(['proveedor', 'turista']);
            expect(shell.groups.find((entry) => entry.group.id === 'turista')?.suppressHeader).toBe(
                false
            );
        });
    });
});
