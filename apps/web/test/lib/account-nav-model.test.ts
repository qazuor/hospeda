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
