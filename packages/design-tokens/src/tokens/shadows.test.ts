/**
 * @file shadows.test.ts
 * @description Unit tests for the shadow tokens. shadowSemantic verified
 * byte-for-byte against the Phase 0 seed manifest; shadowScale verified
 * against doc 05 §5.5.
 */

import { describe, expect, it } from 'vitest';

import { shadowScale, shadowSemantic, shadows } from './shadows.ts';

describe('shadowScale — doc 05 §5.5 conventional elevation', () => {
    it.each([
        ['none', 'none'],
        ['sm', '0 1px 2px 0 oklch(0 0 0 / 0.05)'],
        ['base', '0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px 0 oklch(0 0 0 / 0.06)'],
        ['md', '0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -1px oklch(0 0 0 / 0.06)'],
        ['lg', '0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -2px oklch(0 0 0 / 0.05)'],
        ['xl', '0 20px 25px -5px oklch(0 0 0 / 0.1), 0 10px 10px -5px oklch(0 0 0 / 0.04)']
    ])('%s = %s', (key, expected) => {
        expect(shadowScale[key as keyof typeof shadowScale]).toBe(expected);
    });

    it('declares 6 stops', () => {
        expect(Object.keys(shadowScale)).toHaveLength(6);
    });
});

describe('shadowSemantic — anchored to web seed byte-for-byte', () => {
    it.each([
        ['card', '0 4px 12px -2px oklch(from var(--core-foreground) l c h / 0.08)'],
        ['cardHover', '0 12px 24px -4px oklch(from var(--core-foreground) l c h / 0.12)'],
        ['search', '0 4px 60px oklch(from var(--core-foreground) l c h / 0.1)'],
        ['nav', '0 2px 4px oklch(from var(--core-foreground) l c h / 0.15)']
    ])('%s = %s', (key, expected) => {
        expect(shadowSemantic[key as keyof typeof shadowSemantic]).toBe(expected);
    });

    it('declares 4 semantic shadows', () => {
        expect(Object.keys(shadowSemantic)).toHaveLength(4);
    });
});

describe('shadows aggregate', () => {
    it('groups scale + semantic', () => {
        expect(Object.keys(shadows).sort()).toEqual(['scale', 'semantic']);
    });

    it('preserves identity of sub-namespace references', () => {
        expect(shadows.scale).toBe(shadowScale);
        expect(shadows.semantic).toBe(shadowSemantic);
    });
});
