/**
 * @file typography.test.ts
 * @description Unit tests for the typography tokens. All canonical values
 * verified byte-for-byte against the Phase 0 seed manifest
 * (packages/design-tokens/seed/web-baseline.json) for the entries that
 * exist in web's global.css, and against doc 05 §5.2 for the base scales
 * not currently declared by web (fontSize ladder, fontWeight, lineHeight).
 */

import { describe, expect, it } from 'vitest';

import {
    type FontFamilyName,
    type FontSizeKey,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    semanticTypography,
    typography
} from './typography.ts';

describe('fontFamily', () => {
    it('declares sans, heading, decorative, mono', () => {
        expect(Object.keys(fontFamily).sort()).toEqual(
            ['decorative', 'heading', 'mono', 'sans'].sort()
        );
    });

    const expected: Record<FontFamilyName, string> = {
        sans: '"Roboto", sans-serif',
        heading: '"Geologica", sans-serif',
        decorative: '"Caveat", cursive',
        mono: 'ui-monospace, "Menlo", "Monaco", "Cascadia Code", monospace'
    };

    it.each(Object.entries(expected))(
        '%s matches web seed byte-for-byte',
        (name, expectedValue) => {
            expect(fontFamily[name as FontFamilyName]).toBe(expectedValue);
        }
    );
});

describe('fontSize — doc 05 §5.2 base scale', () => {
    it('declares xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl', () => {
        expect(Object.keys(fontSize).sort()).toEqual(
            ['2xl', '3xl', '4xl', '5xl', 'base', 'lg', 'sm', 'xl', 'xs'].sort()
        );
    });

    const expected: Record<FontSizeKey, string> = {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem'
    };

    it.each(Object.entries(expected))('%s = %s', (key, expectedValue) => {
        expect(fontSize[key as FontSizeKey]).toBe(expectedValue);
    });

    it('progresses monotonically from xs to 5xl', () => {
        const order: FontSizeKey[] = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
        const numericValues = order.map((k) => Number.parseFloat(fontSize[k]));
        for (let i = 1; i < numericValues.length; i++) {
            expect(numericValues[i]).toBeGreaterThan(
                numericValues[i - 1] ?? Number.NEGATIVE_INFINITY
            );
        }
    });
});

describe('fontWeight — doc 05 §5.2', () => {
    it('declares normal, medium, semibold, bold as numeric weights', () => {
        expect(fontWeight).toEqual({
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700
        });
    });
});

describe('lineHeight — doc 05 §5.2', () => {
    it('declares tight, normal, relaxed as numeric ratios', () => {
        expect(lineHeight).toEqual({ tight: 1.2, normal: 1.5, relaxed: 1.75 });
    });
});

describe('semanticTypography — anchored to web seed byte-for-byte', () => {
    // Each row: `[camelCaseKey, web --text-* token name, expected value]`.
    // The web token names are documented for traceability; the test only
    // checks the value matches the seed.
    const cases: ReadonlyArray<readonly [string, string]> = [
        ['hero', 'clamp(3rem, 2rem + 5vw, 5.75rem)'],
        ['display', 'clamp(2rem, 1.5rem + 3vw, 3rem)'],
        ['h2', 'clamp(1.75rem, 1.5rem + 1.75vw, 2.75rem)'],
        ['h3', 'clamp(1.25rem, 1rem + 0.75vw, 1.625rem)'],
        ['h4', 'clamp(0.9375rem, 0.875rem + 0.25vw, 1.125rem)'],
        ['body', '1rem'],
        ['bodySm', '0.875rem'],
        ['bodyXs', '0.8125rem'],
        ['bodyLg', '1.125rem'],
        ['meta', '0.8125rem'],
        ['caption', '0.75rem'],
        ['tagline', 'clamp(1.25rem, 1rem + 1vw, 1.75rem)'],
        ['nav', '0.875rem'],
        ['button', '1rem'],
        ['lg', '1.25rem'],
        ['xl', '1.5rem'],
        ['sm', '0.875rem'],
        ['h6', '1.125rem'],
        ['bodyMd', '0.9375rem']
    ];

    it.each(cases)('%s = %s', (key, expected) => {
        expect(semanticTypography[key as keyof typeof semanticTypography]).toBe(expected);
    });

    it('declares all 19 semantic entries', () => {
        expect(Object.keys(semanticTypography)).toHaveLength(19);
    });
});

describe('typography aggregate', () => {
    it('groups fontFamily, fontSize, fontWeight, lineHeight, semantic', () => {
        expect(Object.keys(typography).sort()).toEqual(
            ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'semantic'].sort()
        );
    });

    it('preserves identity of sub-namespace references', () => {
        expect(typography.fontFamily).toBe(fontFamily);
        expect(typography.fontSize).toBe(fontSize);
        expect(typography.fontWeight).toBe(fontWeight);
        expect(typography.lineHeight).toBe(lineHeight);
        expect(typography.semantic).toBe(semanticTypography);
    });
});
