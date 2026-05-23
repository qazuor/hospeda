/**
 * @file colors.test.ts
 * @description Unit tests for the brand color palettes and the shade
 * derivation algorithm (doc 05 §5.1 specification).
 */

import { describe, expect, it } from 'vitest';

import {
    type OKLCH,
    SHADES,
    accent,
    brandPalettes,
    deriveShades,
    forest,
    formatOKLCH,
    river,
    sand,
    sky
} from './colors.ts';

describe('SHADES constant', () => {
    it('lists all 10 shades in 50→900 order', () => {
        expect([...SHADES]).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
    });
});

describe('deriveShades — algorithm invariants', () => {
    const canonical: OKLCH = { l: 0.63, c: 0.19, h: 259 };
    const palette = deriveShades(canonical);

    it('preserves canonical OKLCH at shade 500', () => {
        expect(palette[500]).toEqual(canonical);
    });

    it('pins lightness to 0.99 at shade 50', () => {
        expect(palette[50].l).toBeCloseTo(0.99, 10);
    });

    it('pins lightness to 0.10 at shade 900', () => {
        expect(palette[900].l).toBeCloseTo(0.1, 10);
    });

    it('keeps hue locked across all shades', () => {
        for (const shade of SHADES) {
            expect(palette[shade].h).toBe(canonical.h);
        }
    });

    it('reduces chroma at extreme shades to ~50% of canonical', () => {
        expect(palette[50].c).toBeCloseTo(canonical.c * 0.5, 10);
        expect(palette[900].c).toBeCloseTo(canonical.c * 0.5, 10);
    });

    it('keeps chroma at canonical strength at shade 500', () => {
        expect(palette[500].c).toBe(canonical.c);
    });

    it('progresses lightness monotonically from 50 (lightest) to 900 (darkest)', () => {
        const lightnesses = SHADES.map((s) => palette[s].l);
        for (let i = 1; i < lightnesses.length; i++) {
            expect(lightnesses[i]).toBeLessThan(lightnesses[i - 1] ?? Number.POSITIVE_INFINITY);
        }
    });

    it('returns a frozen object (palettes are constants)', () => {
        expect(Object.isFrozen(palette)).toBe(true);
    });
});

describe('deriveShades — edge inputs', () => {
    it('handles a chroma-zero canonical (true gray) without producing NaN', () => {
        const gray = deriveShades({ l: 0.55, c: 0, h: 0 });
        for (const shade of SHADES) {
            expect(gray[shade].c).toBe(0);
            expect(gray[shade].h).toBe(0);
            expect(Number.isFinite(gray[shade].l)).toBe(true);
        }
    });

    it('handles a canonical with non-integer hue (e.g. web destructive 27.325)', () => {
        const reddish = deriveShades({ l: 0.577, c: 0.245, h: 27.325 });
        for (const shade of SHADES) {
            expect(reddish[shade].h).toBe(27.325);
        }
    });
});

describe('formatOKLCH', () => {
    it('serializes a canonical value without trailing zeros (matches web global.css shape)', () => {
        expect(formatOKLCH({ l: 0.63, c: 0.19, h: 259 })).toBe('oklch(0.63 0.19 259)');
    });

    it('rounds to 3 decimal places to neutralize IEEE-754 drift', () => {
        // Mid-shade values that would otherwise produce a long decimal tail.
        expect(formatOKLCH({ l: 0.7019999999, c: 0.152, h: 259 })).toBe('oklch(0.702 0.152 259)');
    });

    it('strips trailing zeros from integer values', () => {
        expect(formatOKLCH({ l: 1, c: 0, h: 0 })).toBe('oklch(1 0 0)');
    });
});

describe('Brand palettes — canonical values match doc 05 §5.1 + web baseline', () => {
    // Each row is `[paletteName, palette, expected canonical CSS string]`.
    // The CSS strings come from apps/web/src/styles/global.css (verified
    // byte-for-byte by the Phase 0 extractor).
    const cases: ReadonlyArray<readonly [string, typeof river, string]> = [
        ['river', river, 'oklch(0.63 0.19 259)'],
        ['sky', sky, 'oklch(0.8 0.08 259)'],
        ['forest', forest, 'oklch(0.5 0.14 155)'],
        ['sand', sand, 'oklch(0.7 0.12 75)'],
        ['accent', accent, 'oklch(0.7 0.18 55)']
    ];

    it.each(cases)('%s shade 500 serializes to %s', (_name, palette, expected) => {
        expect(formatOKLCH(palette[500])).toBe(expected);
    });
});

describe('brandPalettes aggregate', () => {
    it('exposes all 5 brand palettes as named entries', () => {
        expect(Object.keys(brandPalettes).sort()).toEqual(
            ['accent', 'forest', 'river', 'sand', 'sky'].sort()
        );
    });

    it('matches the individual exports by reference', () => {
        expect(brandPalettes.river).toBe(river);
        expect(brandPalettes.sky).toBe(sky);
        expect(brandPalettes.forest).toBe(forest);
        expect(brandPalettes.sand).toBe(sand);
        expect(brandPalettes.accent).toBe(accent);
    });
});
