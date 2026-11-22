/**
 * Tests for the header user menu's account links (HOS-2551).
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getCuratedAccountNav } from '../../src/lib/nav-avatar';

const adminIds = (params: Parameters<typeof getCuratedAccountNav>[0]) =>
    getCuratedAccountNav(params).adminItems.map((item) => item.id);

describe('getCuratedAccountNav', () => {
    it('always returns the «Mi cuenta» identity link to /mi-cuenta/', () => {
        const { dashboardItem } = getCuratedAccountNav({ permissions: [] });
        expect(dashboardItem?.id).toBe('dashboard');
        expect(dashboardItem?.href).toBe('mi-cuenta');
    });

    it('gives a pure tourist no «Administración» shortcut', () => {
        expect(adminIds({ permissions: [] })).toEqual([]);
    });

    it('lists one shortcut per vertical, in the owner order', () => {
        const { adminItems } = getCuratedAccountNav({
            permissions: [
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.VENUE_EDIT_OWN,
                PermissionEnum.EXPERIENCE_EDIT_OWN,
                PermissionEnum.POST_CREATE
            ],
            ownsHostTradeListing: true,
            ownsPartner: true
        });
        expect(adminItems.map((item) => [item.id, item.href])).toEqual([
            ['accommodations', 'mi-cuenta/host-dashboard'],
            ['venues', 'mi-cuenta/comercio'],
            ['experiences', 'mi-cuenta/comercio'],
            ['editorial', 'mi-cuenta/publicaciones'],
            ['partner', 'mi-cuenta/partner'],
            ['provider', 'mi-cuenta/proveedor']
        ]);
    });

    it('phrases every shortcut as managing', () => {
        const { adminItems } = getCuratedAccountNav({
            permissions: [PermissionEnum.ACCOMMODATION_CREATE],
            ownsHostTradeListing: true
        });
        expect(adminItems.map((item) => item.i18nKey)).toEqual([
            'account.nav.manageAccommodations',
            'account.nav.manageProvider'
        ]);
    });

    it('gates venues and experiences by their own permission', () => {
        expect(adminIds({ permissions: [PermissionEnum.VENUE_EDIT_OWN] })).toEqual(['venues']);
        expect(adminIds({ permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN] })).toEqual([
            'experiences'
        ]);
    });

    it('sends an events-only editor to «Mis eventos»', () => {
        const { adminItems } = getCuratedAccountNav({
            permissions: [PermissionEnum.EVENT_CREATE]
        });
        expect(adminItems.map((item) => [item.id, item.href])).toEqual([
            ['editorial', 'mi-cuenta/eventos']
        ]);
    });

    it('gates partner and provider by row ownership, never by permission', () => {
        expect(adminIds({ permissions: [], ownsHostTradeListing: true })).toEqual(['provider']);
        expect(adminIds({ permissions: [], ownsPartner: true })).toEqual(['partner']);
    });
});
