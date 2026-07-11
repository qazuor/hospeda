/**
 * @file admin-panel-link.test.ts
 * @description Unit tests for the shared admin-panel session link builder
 * (HOS-131 §6.4/§6.5), used by both UserMenu and MobileMenu.
 */

import { describe, expect, it } from 'vitest';
import {
    ADMIN_PANEL_PERMISSION,
    buildAdminPanelItem,
    STAFF_DISCRIMINATOR_PERMISSION
} from '../../src/lib/admin-panel-link';

describe('buildAdminPanelItem', () => {
    it('returns null when adminPanelUrl is undefined, even with the permission', () => {
        const item = buildAdminPanelItem({
            locale: 'es',
            adminPanelUrl: undefined,
            permissions: [ADMIN_PANEL_PERMISSION]
        });
        expect(item).toBeNull();
    });

    it('returns null when the user lacks access.panelAdmin', () => {
        const item = buildAdminPanelItem({
            locale: 'es',
            adminPanelUrl: 'https://admin.test',
            permissions: []
        });
        expect(item).toBeNull();
    });

    it('fails closed (null) while permissions are still loading (caller passes [])', () => {
        const item = buildAdminPanelItem({
            locale: 'es',
            adminPanelUrl: 'https://admin.test',
            permissions: []
        });
        expect(item).toBeNull();
    });

    it('returns "Modo anfitrión" for a HOST (access.panelAdmin without access.apiAdmin)', () => {
        const item = buildAdminPanelItem({
            locale: 'es',
            adminPanelUrl: 'https://admin.test',
            permissions: [ADMIN_PANEL_PERMISSION]
        });
        expect(item).toEqual({
            label: 'Modo anfitrión',
            href: 'https://admin.test',
            icon: expect.any(Function)
        });
    });

    it('returns "Panel de administración" for staff (access.apiAdmin present)', () => {
        const item = buildAdminPanelItem({
            locale: 'es',
            adminPanelUrl: 'https://admin.test',
            permissions: [ADMIN_PANEL_PERMISSION, STAFF_DISCRIMINATOR_PERMISSION]
        });
        expect(item?.label).toBe('Panel de administración');
    });

    it('resolves English labels for locale=en', () => {
        const hostItem = buildAdminPanelItem({
            locale: 'en',
            adminPanelUrl: 'https://admin.test',
            permissions: [ADMIN_PANEL_PERMISSION]
        });
        expect(hostItem?.label).toBe('Host mode');

        const staffItem = buildAdminPanelItem({
            locale: 'en',
            adminPanelUrl: 'https://admin.test',
            permissions: [ADMIN_PANEL_PERMISSION, STAFF_DISCRIMINATOR_PERMISSION]
        });
        expect(staffItem?.label).toBe('Admin panel');
    });

    it('resolves Portuguese labels for locale=pt', () => {
        const item = buildAdminPanelItem({
            locale: 'pt',
            adminPanelUrl: 'https://admin.test',
            permissions: [ADMIN_PANEL_PERMISSION, STAFF_DISCRIMINATOR_PERMISSION]
        });
        expect(item?.label).toBe('Painel de administração');
    });
});
