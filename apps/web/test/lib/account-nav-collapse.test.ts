/**
 * @file account-nav-collapse.test.ts
 * @description Unit tests for the collapsible account-nav helpers (HOS-2124).
 */

import { describe, expect, it } from 'vitest';
import type { NavGroup } from '../../src/config/navigation';
import { PROVIDER_NAV_GROUP } from '../../src/config/navigation';
import {
    parseStoredNavState,
    placeProviderGroup,
    resolveGroupDefaultOpen
} from '../../src/lib/account-nav-collapse';

const group = (id: string): NavGroup => ({ id, i18nKey: `k.${id}`, items: [] });

describe('resolveGroupDefaultOpen', () => {
    it('collapses turista when the user has another area besides cuenta', () => {
        expect(
            resolveGroupDefaultOpen({
                groupId: 'turista',
                visibleGroupIds: ['cuenta', 'anfitrion', 'turista'],
                containsActive: false
            })
        ).toBe(false);
    });

    it('keeps turista open when cuenta is the only other area', () => {
        expect(
            resolveGroupDefaultOpen({
                groupId: 'turista',
                visibleGroupIds: ['cuenta', 'turista'],
                containsActive: false
            })
        ).toBe(true);
    });

    it('keeps turista open when the current page belongs to it', () => {
        expect(
            resolveGroupDefaultOpen({
                groupId: 'turista',
                visibleGroupIds: ['cuenta', 'editorial', 'turista'],
                containsActive: true
            })
        ).toBe(true);
    });

    it.each([
        'cuenta',
        'anfitrion',
        'comercio',
        'editorial',
        'proveedor'
    ])('opens %s by default', (groupId) => {
        expect(
            resolveGroupDefaultOpen({
                groupId,
                visibleGroupIds: ['cuenta', groupId, 'turista'],
                containsActive: false
            })
        ).toBe(true);
    });

    it('counts proveedor as an area that collapses turista', () => {
        expect(
            resolveGroupDefaultOpen({
                groupId: 'turista',
                visibleGroupIds: ['cuenta', 'proveedor', 'turista'],
                containsActive: false
            })
        ).toBe(false);
    });
});

describe('placeProviderGroup', () => {
    it('inserts proveedor right before turista', () => {
        const result = placeProviderGroup({
            groups: [group('cuenta'), group('editorial'), group('turista')],
            providerGroup: PROVIDER_NAV_GROUP
        });
        expect(result.map((g) => g.id)).toEqual(['cuenta', 'editorial', 'proveedor', 'turista']);
    });

    it('returns the groups untouched without a provider group', () => {
        const groups = [group('cuenta'), group('turista')];
        expect(placeProviderGroup({ groups, providerGroup: null })).toBe(groups);
    });

    it('appends when turista is absent', () => {
        const result = placeProviderGroup({
            groups: [group('cuenta')],
            providerGroup: PROVIDER_NAV_GROUP
        });
        expect(result.map((g) => g.id)).toEqual(['cuenta', 'proveedor']);
    });
});

describe('parseStoredNavState', () => {
    it('parses a valid map', () => {
        expect(parseStoredNavState({ raw: '{"turista":true,"cuenta":false}' })).toEqual({
            turista: true,
            cuenta: false
        });
    });

    it.each([null, '', 'not json', '[1,2]', '"x"', 'null'])('returns {} for %s', (raw) => {
        expect(parseStoredNavState({ raw })).toEqual({});
    });

    it('drops non-boolean values', () => {
        expect(parseStoredNavState({ raw: '{"a":1,"b":true,"c":"yes"}' })).toEqual({ b: true });
    });
});
