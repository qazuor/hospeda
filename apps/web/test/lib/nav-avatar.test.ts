import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import { getCuratedAccountNav, pickBusinessShortcut } from '../../src/lib/nav-avatar';

describe('pickBusinessShortcut', () => {
    it('picks hostDashboard for a user with ACCOMMODATION_CREATE', () => {
        const { item } = pickBusinessShortcut({
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });
        expect(item?.id).toBe('hostDashboard');
    });

    it('picks commerce for a user with only COMMERCE_EDIT_OWN', () => {
        const { item } = pickBusinessShortcut({
            permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
        });
        expect(item?.id).toBe('commerce');
    });

    it('prioritizes hostDashboard over commerce when the user has both permissions', () => {
        const { item } = pickBusinessShortcut({
            permissions: [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.COMMERCE_EDIT_OWN]
        });
        expect(item?.id).toBe('hostDashboard');
    });

    it('returns null when the user has neither business permission', () => {
        const { item } = pickBusinessShortcut({ permissions: [] });
        expect(item).toBeNull();
    });

    it('fails closed (null) while permissions are still loading (caller passes [])', () => {
        const { item } = pickBusinessShortcut({ permissions: [] });
        expect(item).toBeNull();
    });
});

describe('getCuratedAccountNav', () => {
    it('always resolves the dashboard item as the identity-zone "Mi cuenta" link', () => {
        const { dashboardItem } = getCuratedAccountNav({ permissions: [] });
        expect(dashboardItem?.id).toBe('dashboard');
    });

    it('orders shortcuts as favorites, then subscription when the user has no business permission', () => {
        const { shortcutItems } = getCuratedAccountNav({ permissions: [] });
        expect(shortcutItems.map((item) => item.id)).toEqual(['favorites', 'subscription']);
    });

    it('inserts the business shortcut between favorites and subscription for a host', () => {
        const { shortcutItems } = getCuratedAccountNav({
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });
        expect(shortcutItems.map((item) => item.id)).toEqual([
            'favorites',
            'hostDashboard',
            'subscription'
        ]);
    });

    it('inserts the commerce shortcut for a commerce-only owner', () => {
        const { shortcutItems } = getCuratedAccountNav({
            permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
        });
        expect(shortcutItems.map((item) => item.id)).toEqual([
            'favorites',
            'commerce',
            'subscription'
        ]);
    });

    it('never shows both business shortcuts even when the user has both permissions', () => {
        const { shortcutItems } = getCuratedAccountNav({
            permissions: [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.COMMERCE_EDIT_OWN]
        });
        expect(shortcutItems.filter((item) => item.id === 'hostDashboard')).toHaveLength(1);
        expect(shortcutItems.filter((item) => item.id === 'commerce')).toHaveLength(0);
    });

    it('never leaks non-curated items (e.g. properties, reviews, newsletter)', () => {
        const { dashboardItem, shortcutItems } = getCuratedAccountNav({
            permissions: [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.COMMERCE_EDIT_OWN]
        });
        const ids = [dashboardItem?.id, ...shortcutItems.map((item) => item.id)];
        expect(ids).not.toContain('properties');
        expect(ids).not.toContain('reviews');
        expect(ids).not.toContain('newsletter');
        expect(ids).not.toContain('preferences');
    });
});
