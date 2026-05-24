/**
 * @file radius.test.ts
 * @description Unit tests for the radius tokens. All values verified
 * byte-for-byte against the Phase 0 seed manifest.
 */

import { describe, expect, it } from 'vitest';

import { radius, radiusBase, radiusOrganic, radiusScale, radiusSemantic } from './radius.ts';

describe('radiusBase — doc 05 §5.4 + web seed', () => {
    it('equals 0.75rem (the canonical --radius value)', () => {
        expect(radiusBase).toBe('0.75rem');
    });
});

describe('radiusScale — calc() expressions anchored to web seed', () => {
    it.each([
        ['sm', 'calc(var(--radius) - 4px)'],
        ['md', 'calc(var(--radius) - 2px)'],
        ['lg', 'var(--radius)'],
        ['xl', 'calc(var(--radius) + 4px)']
    ])('%s = %s', (key, expected) => {
        expect(radiusScale[key as keyof typeof radiusScale]).toBe(expected);
    });

    it('declares 4 stops', () => {
        expect(Object.keys(radiusScale)).toHaveLength(4);
    });
});

describe('radiusSemantic — absolute component values', () => {
    it.each([
        ['card', '24px'],
        ['pill', '9999px'],
        ['button', '8px']
    ])('%s = %s', (key, expected) => {
        expect(radiusSemantic[key as keyof typeof radiusSemantic]).toBe(expected);
    });

    it('declares 3 component values', () => {
        expect(Object.keys(radiusSemantic)).toHaveLength(3);
    });
});

describe('radiusOrganic — deprecated, exported for web compat', () => {
    it.each([
        ['base', '0px 100px'],
        ['sm', '0px 75px'],
        ['alt', '100px 0px']
    ])('%s = %s', (key, expected) => {
        expect(radiusOrganic[key as keyof typeof radiusOrganic]).toBe(expected);
    });
});

describe('radius aggregate', () => {
    it('groups base + scale + semantic + organic', () => {
        expect(Object.keys(radius).sort()).toEqual(['base', 'organic', 'scale', 'semantic'].sort());
    });

    it('preserves identity of sub-namespace references', () => {
        expect(radius.base).toBe(radiusBase);
        expect(radius.scale).toBe(radiusScale);
        expect(radius.semantic).toBe(radiusSemantic);
        expect(radius.organic).toBe(radiusOrganic);
    });
});
