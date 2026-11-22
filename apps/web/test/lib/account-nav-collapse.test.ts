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
    resolveGroupDefaultOpen
} from '../../src/lib/account-nav-collapse';

const group = (id: string): NavGroup => ({ id, i18nKey: `k.${id}`, items: [] });

describe('resolveGroupDefaultOpen', () => {
    it('opens the group that holds the current page', () => {
        expect(resolveGroupDefaultOpen({ containsActive: true })).toBe(true);
    });

    it('closes every other group, tourist included or not (HOS-2549)', () => {
        expect(resolveGroupDefaultOpen({ containsActive: false })).toBe(false);
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
