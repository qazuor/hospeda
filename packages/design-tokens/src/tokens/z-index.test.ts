/**
 * @file z-index.test.ts
 * @description Unit tests for the z-index ladder. Values verified
 * byte-for-byte against the Phase 0 seed manifest.
 */

import { describe, expect, it } from 'vitest';

import { type ZIndexName, zIndex } from './z-index.ts';

describe('zIndex ladder — anchored to web seed', () => {
    const expected: Record<ZIndexName, number> = {
        content: 10,
        nav: 50,
        dropdown: 60,
        modal: 100,
        toast: 200,
        cookieBanner: 9000,
        mobileMenu: 9100
    };

    it.each(Object.entries(expected))('%s = %i', (key, expectedValue) => {
        expect(zIndex[key as ZIndexName]).toBe(expectedValue);
    });

    it('declares 7 layers', () => {
        expect(Object.keys(zIndex)).toHaveLength(7);
    });

    it('orders layers strictly by stacking position', () => {
        // The layer order is the architectural contract — modal must
        // sit above dropdown, toast above modal, and the 9000+ block
        // above every in-page layer.
        const ordered: ZIndexName[] = [
            'content',
            'nav',
            'dropdown',
            'modal',
            'toast',
            'cookieBanner',
            'mobileMenu'
        ];
        for (let i = 1; i < ordered.length; i++) {
            const prev = ordered[i - 1];
            const cur = ordered[i];
            if (prev && cur) {
                expect(zIndex[cur]).toBeGreaterThan(zIndex[prev]);
            }
        }
    });

    it('keeps mobileMenu above cookieBanner so the menu obscures the banner when both render', () => {
        expect(zIndex.mobileMenu).toBeGreaterThan(zIndex.cookieBanner);
    });
});
