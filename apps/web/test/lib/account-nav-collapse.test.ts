/**
 * @file account-nav-collapse.test.ts
 * @description Unit tests for the collapsible account-nav helpers (HOS-2124).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavGroup } from '../../src/config/navigation';
import { PROVIDER_NAV_GROUP } from '../../src/config/navigation';
import {
    ACCOUNT_NAV_STORAGE_KEY,
    applyStoredNavState,
    parseStoredNavState,
    placeProviderGroup,
    resolveGroupDefaultOpen,
    resolveShellGroupOpen
} from '../../src/lib/account-nav-collapse';

const group = (id: string): NavGroup => ({ id, i18nKey: `k.${id}`, items: [] });

describe('resolveGroupDefaultOpen (legacy layout)', () => {
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
});

describe('resolveShellGroupOpen', () => {
    it('opens the group that holds the current page', () => {
        expect(
            resolveShellGroupOpen({
                containsActive: true,
                anyGroupContainsActive: true,
                isFirstHeadedGroup: false
            })
        ).toBe(true);
    });

    it('closes the others when some group holds the page', () => {
        expect(
            resolveShellGroupOpen({
                containsActive: false,
                anyGroupContainsActive: true,
                isFirstHeadedGroup: true
            })
        ).toBe(false);
    });

    it('opens the first headed group when no group holds the page', () => {
        expect(
            resolveShellGroupOpen({
                containsActive: false,
                anyGroupContainsActive: false,
                isFirstHeadedGroup: true
            })
        ).toBe(true);
        expect(
            resolveShellGroupOpen({
                containsActive: false,
                anyGroupContainsActive: false,
                isFirstHeadedGroup: false
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

describe('applyStoredNavState', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    function mount(): void {
        document.body.innerHTML = `
            <nav data-account-sidebar>
                <details data-nav-group="cuenta" data-contains-active="true" open><summary>c</summary></details>
                <details data-nav-group="anfitrion"><summary>a</summary></details>
            </nav>`;
    }
    const group = (id: string) =>
        document.querySelector<HTMLDetailsElement>(
            `details[data-nav-group="${id}"]`
        ) as HTMLDetailsElement;

    function memoryStorage(initial?: string) {
        const data = new Map<string, string>();
        if (initial) data.set(ACCOUNT_NAV_STORAGE_KEY, initial);
        return {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, v)
        };
    }

    it('opens a remembered group but never closes the active one', () => {
        mount();
        const storage = memoryStorage('{"anfitrion":true,"cuenta":false}');
        applyStoredNavState({ root: document, storage: () => storage });
        expect(group('anfitrion').open).toBe(true);
        expect(group('cuenta').open).toBe(true);
    });

    it('persists a toggle made from the summary', () => {
        mount();
        const storage = memoryStorage();
        applyStoredNavState({ root: document, storage: () => storage });
        group('anfitrion').querySelector('summary')?.click();
        expect(JSON.parse(storage.getItem(ACCOUNT_NAV_STORAGE_KEY) ?? '{}')).toEqual({
            anfitrion: true
        });
    });

    it('survives a storage getter that throws on every access', () => {
        mount();
        expect(() =>
            applyStoredNavState({
                root: document,
                storage: () => {
                    throw new Error('SecurityError');
                }
            })
        ).not.toThrow();
        expect(() => group('anfitrion').querySelector('summary')?.click()).not.toThrow();
        expect(group('cuenta').open).toBe(true);
    });

    it('ignores a stored value that contradicts the active group', () => {
        mount();
        applyStoredNavState({
            root: document,
            storage: () => memoryStorage('{"cuenta":false}')
        });
        expect(group('cuenta').open).toBe(true);
    });

    it('falls back to the rendered defaults when storage throws', () => {
        mount();
        const broken = () => {
            throw new Error('denied');
        };
        const spy = vi.fn(broken);
        expect(() => applyStoredNavState({ root: document, storage: spy })).not.toThrow();
        expect(group('anfitrion').open).toBe(false);
        expect(() => group('anfitrion').querySelector('summary')?.click()).not.toThrow();
        expect(group('cuenta').open).toBe(true);
    });
});
