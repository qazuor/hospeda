/**
 * @file layout.test.ts
 * @description Unit tests for the layout tokens. All values verified
 * byte-for-byte against the Phase 0 seed manifest.
 */

import { describe, expect, it } from 'vitest';

import { layout, layoutChrome, layoutContainer, layoutMediaOverrides } from './layout.ts';

describe('layoutChrome — anchored to web seed', () => {
    it.each([
        ['navbarHeight', '80px'],
        ['waveBarCompact', '77px'],
        ['cookieBannerHeight', '0px'],
        ['bottomSafeInset', 'var(--cookie-banner-height, 0px)']
    ])('%s = %s', (key, expected) => {
        expect(layoutChrome[key as keyof typeof layoutChrome]).toBe(expected);
    });

    it('declares 4 chrome dimensions', () => {
        expect(Object.keys(layoutChrome)).toHaveLength(4);
    });
});

describe('layoutContainer — anchored to web seed', () => {
    it.each([
        ['max', '1350px'],
        ['narrow', '900px']
    ])('%s = %s', (key, expected) => {
        expect(layoutContainer[key as keyof typeof layoutContainer]).toBe(expected);
    });
});

describe('layoutMediaOverrides — media-block values', () => {
    it('overrides container-max to 1500px at (min-width: 1600px)', () => {
        expect(layoutMediaOverrides['(min-width: 1600px)']?.['container-max']).toBe('1500px');
    });

    it('declares exactly the seed manifest media entry', () => {
        expect(Object.keys(layoutMediaOverrides)).toEqual(['(min-width: 1600px)']);
    });
});

describe('layout aggregate', () => {
    it('groups chrome + container + mediaOverrides', () => {
        expect(Object.keys(layout).sort()).toEqual(
            ['chrome', 'container', 'mediaOverrides'].sort()
        );
    });

    it('preserves identity of sub-namespace references', () => {
        expect(layout.chrome).toBe(layoutChrome);
        expect(layout.container).toBe(layoutContainer);
        expect(layout.mediaOverrides).toBe(layoutMediaOverrides);
    });
});
