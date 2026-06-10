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
    accommodationTypePalettes,
    avatarGradients,
    brandPalettes,
    brandSecondary,
    brandSecondaryForeground,
    brandTertiary,
    chartColors,
    cyan,
    danger,
    deriveShades,
    forest,
    formatOKLCH,
    info,
    neutral,
    palettes,
    purple,
    ratingStar,
    river,
    rose,
    sand,
    semanticPalettes,
    sky,
    skyLight,
    success,
    surfaces,
    teal,
    terracotta,
    warning
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

describe('Semantic palettes — canonical values match web baseline', () => {
    // Each row is `[paletteName, palette, expected canonical CSS string]`.
    // The CSS strings come from apps/web/src/styles/global.css :root —
    // semantic palettes anchor to web's current values, NOT doc 05 §5.1's
    // post-V1 targets (e.g. success here is 0.58 not doc 05's 0.62).
    const cases: ReadonlyArray<readonly [string, typeof success, string]> = [
        ['success', success, 'oklch(0.58 0.15 150)'],
        ['warning', warning, 'oklch(0.75 0.18 85)'],
        ['danger', danger, 'oklch(0.577 0.245 27.325)'],
        ['info', info, 'oklch(0.63 0.19 259)']
    ];

    it.each(cases)('%s shade 500 serializes to %s', (_name, palette, expected) => {
        expect(formatOKLCH(palette[500])).toBe(expected);
    });

    it('aggregates all 4 semantic palettes', () => {
        expect(Object.keys(semanticPalettes).sort()).toEqual(
            ['danger', 'info', 'success', 'warning'].sort()
        );
    });
});

describe('Accommodation-type palettes — product-owner approved canonical values', () => {
    // Each row is `[paletteName, palette, expected canonical CSS string]`.
    // The 5 new palettes give each accommodation type its own distinct hue.
    const cases: ReadonlyArray<readonly [string, typeof teal, string]> = [
        ['teal', teal, 'oklch(0.6 0.1 185)'],
        ['cyan', cyan, 'oklch(0.65 0.12 220)'],
        ['terracotta', terracotta, 'oklch(0.58 0.12 40)'],
        ['rose', rose, 'oklch(0.62 0.16 350)'],
        ['purple', purple, 'oklch(0.55 0.17 310)']
    ];

    it.each(cases)('%s shade 500 serializes to %s', (_name, palette, expected) => {
        expect(formatOKLCH(palette[500])).toBe(expected);
    });

    it('aggregates all 5 accommodation-type palettes', () => {
        expect(Object.keys(accommodationTypePalettes).sort()).toEqual(
            ['cyan', 'purple', 'rose', 'teal', 'terracotta'].sort()
        );
    });

    it('matches the individual exports by reference', () => {
        expect(accommodationTypePalettes.teal).toBe(teal);
        expect(accommodationTypePalettes.cyan).toBe(cyan);
        expect(accommodationTypePalettes.terracotta).toBe(terracotta);
        expect(accommodationTypePalettes.rose).toBe(rose);
        expect(accommodationTypePalettes.purple).toBe(purple);
    });
});

describe('neutral palette', () => {
    it('declares all 10 shades with chroma 0 and hue 0', () => {
        for (const shade of SHADES) {
            expect(neutral[shade].c).toBe(0);
            expect(neutral[shade].h).toBe(0);
        }
    });

    it('matches doc 05 §5.1 hand-tuned lightness ladder', () => {
        // Exact stops per doc 05 §5.1 — NOT derived from `deriveShades`
        // because the cluster is hand-tuned for UI surface granularity.
        const expected: Record<(typeof SHADES)[number], number> = {
            50: 0.985,
            100: 0.95,
            200: 0.9,
            300: 0.83,
            400: 0.7,
            500: 0.55,
            600: 0.42,
            700: 0.3,
            800: 0.18,
            900: 0.1
        };
        for (const shade of SHADES) {
            expect(neutral[shade].l).toBe(expected[shade]);
        }
    });

    it('progresses lightness monotonically from 50 to 900', () => {
        const ls = SHADES.map((s) => neutral[s].l);
        for (let i = 1; i < ls.length; i++) {
            expect(ls[i]).toBeLessThan(ls[i - 1] ?? Number.POSITIVE_INFINITY);
        }
    });

    it('is frozen', () => {
        expect(Object.isFrozen(neutral)).toBe(true);
    });
});

describe('master palettes aggregate', () => {
    it('contains all 5 brand + 4 semantic + 5 accommodation-type + 1 neutral = 15 palettes', () => {
        expect(Object.keys(palettes).sort()).toEqual(
            [
                'accent',
                'danger',
                'forest',
                'info',
                'neutral',
                'river',
                'sand',
                'sky',
                'success',
                'warning',
                // accommodation-type palettes (give each type its own hue)
                'teal',
                'cyan',
                'terracotta',
                'rose',
                'purple'
            ].sort()
        );
    });
});

describe('Web extras — single primitives match seed manifest', () => {
    // Each row: `[exportName, value, expected canonical CSS string]`.
    // Values from apps/web/src/styles/global.css :root, captured in seed.
    const cases: ReadonlyArray<readonly [string, OKLCH, string]> = [
        ['skyLight', skyLight, 'oklch(0.88 0.06 259)'],
        ['brandSecondary', brandSecondary, 'oklch(0.96 0.02 236)'],
        ['brandSecondaryForeground', brandSecondaryForeground, 'oklch(0.26 0.06 255)'],
        ['brandTertiary', brandTertiary, 'oklch(0.92 0.03 155)'],
        ['ratingStar', ratingStar, 'oklch(0.82 0.19 95)']
    ];

    it.each(cases)('%s serializes to %s', (_name, value, expected) => {
        expect(formatOKLCH(value)).toBe(expected);
    });
});

describe('avatarGradients', () => {
    it('declares 4 gradients each with from/to OKLCH stops', () => {
        for (const key of [1, 2, 3, 4] as const) {
            const grad = avatarGradients[key];
            expect(grad.from).toMatchObject({ l: expect.any(Number) });
            expect(grad.to).toMatchObject({ l: expect.any(Number) });
        }
    });

    it('matches seed values for gradient 1 (blue)', () => {
        expect(formatOKLCH(avatarGradients[1].from)).toBe('oklch(0.25 0.08 255)');
        expect(formatOKLCH(avatarGradients[1].to)).toBe('oklch(0.36 0.12 255)');
    });

    it('matches seed values for gradient 4 (green)', () => {
        expect(formatOKLCH(avatarGradients[4].from)).toBe('oklch(0.42 0.12 155)');
        expect(formatOKLCH(avatarGradients[4].to)).toBe('oklch(0.62 0.16 155)');
    });
});

describe('chartColors', () => {
    it('declares exactly 5 series colors in order chart-1..chart-5', () => {
        expect(chartColors).toHaveLength(5);
    });

    it('matches seed values for all 5 series', () => {
        const expected = [
            'oklch(0.63 0.19 259)',
            'oklch(0.6 0.14 155)',
            'oklch(0.7 0.18 55)',
            'oklch(0.75 0.1 190)',
            'oklch(0.5 0.08 240)'
        ];
        for (let i = 0; i < 5; i++) {
            expect(formatOKLCH(chartColors[i] as OKLCH)).toBe(expected[i]);
        }
    });
});

describe('surfaces', () => {
    it('declares warm/dark/elevated + their foreground variants', () => {
        expect(Object.keys(surfaces).sort()).toEqual(
            ['dark', 'darkForeground', 'elevated', 'warm', 'warmForeground'].sort()
        );
    });

    it('matches seed values', () => {
        expect(formatOKLCH(surfaces.warm)).toBe('oklch(0.95 0.03 250)');
        expect(formatOKLCH(surfaces.warmForeground)).toBe('oklch(0.35 0.03 250)');
        expect(formatOKLCH(surfaces.dark)).toBe('oklch(0.15 0.02 160)');
        expect(formatOKLCH(surfaces.darkForeground)).toBe('oklch(0.92 0.01 210)');
        expect(formatOKLCH(surfaces.elevated)).toBe('oklch(1 0 0)');
    });
});
