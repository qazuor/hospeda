/**
 * @file plan-comparison-contrast.test.ts
 * @description WCAG contrast guard for the plan comparison table (HOS-1766).
 *
 * `PlanComparisonTable.astro` painted the "included" check and the "Ilimitado"
 * value with `--brand-tertiary`, which is a pale-green SURFACE tint (L 0.92),
 * not an ink: 1.25:1 on the white card in light and 1.04:1 in dark, i.e.
 * invisible. The "Próximamente" badge used the orange `--brand-accent` as ink on
 * a 15% blue tint (about 2.5:1), and the plan price used the same orange fill
 * token as text on the white header (2.82:1).
 *
 * The repair repoints each at an existing token that is meant to be read:
 *
 *   - check + "Ilimitado" -> `--hospeda-forest-link` (SPEC-308's AA-safe green
 *     TEXT step; its ratios are also pinned by `green-text-contrast.test.ts`)
 *   - plan price          -> `--brand-accent-text` (orange meant for text)
 *   - "Próximamente" chip -> `--core-foreground` on the unchanged tint
 *
 * This file asserts the premise that licenses each choice, in BOTH themes and
 * on BOTH surfaces a row can sit on (`--core-card`, and `--surface-warm` while
 * the row is hovered), and that the retired pairings really fail. The math is
 * the WCAG 2.1 formula over gamut-mapped, 8-bit-quantised sRGB, copied from
 * `green-text-contrast.test.ts` on purpose so either guard can evolve alone.
 *
 * `apps/web/test/components/billing/plan-comparison-table-contrast.test.ts`
 * pins the CONSUMER (which token each selector uses), so the two cannot drift.
 *
 * @module tokens/plan-comparison-contrast
 */

import { clampChroma, converter } from 'culori';
import { describe, expect, it } from 'vitest';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';

/** WCAG 2.1 AA minimum for normal-size text. */
const AA_TEXT = 4.5;
/** WCAG 2.1 AA minimum for graphical objects (the check icon). */
const AA_GRAPHIC = 3;
/** Opacity of the "not included" minus glyph (`.comparison-table__icon--not-included`). */
const NOT_INCLUDED_OPACITY = 0.7;
/** Opacity the glyph had before HOS-1766. */
const NOT_INCLUDED_OPACITY_RETIRED = 0.5;
/** Alpha of `--brand-primary-a15`, the chip fill. */
const CHIP_ALPHA = 0.15;

const toRgb = converter('rgb');

/** Dark overrides a SUBSET of `:root`; layer the records like the cascade does. */
const webDarkEffective: Theme = { ...webLight, ...webDark };

interface Rgb {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

function isOklch(value: ThemeValue | undefined): value is OKLCH {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as OKLCH).l === 'number' &&
        typeof (value as OKLCH).c === 'number' &&
        typeof (value as OKLCH).h === 'number'
    );
}

function oklchToken(theme: Theme, token: string): OKLCH {
    const value = theme[token];
    if (!isOklch(value)) {
        throw new Error(
            `--${token} must be a literal OKLCH triple to be contrast-checked, got: ${JSON.stringify(value)}`
        );
    }
    return value;
}

/** Gamut-mapped, 8-bit-quantised sRGB in [0, 1]. */
function toSrgb(value: OKLCH): Rgb {
    const mapped = clampChroma(
        { mode: 'oklch', l: value.l, c: value.c, h: value.h },
        'oklch',
        'rgb'
    );
    const rgb = toRgb(mapped);
    const quantize = (channel: number | undefined) =>
        Math.round(Math.max(0, Math.min(1, channel ?? 0)) * 255) / 255;
    return { r: quantize(rgb?.r), g: quantize(rgb?.g), b: quantize(rgb?.b) };
}

/** Source-over compositing of `fg` at `alpha` onto an opaque `bg`, 8-bit quantised. */
function composite({ fg, bg, alpha }: { fg: Rgb; bg: Rgb; alpha: number }): Rgb {
    const channel = (f: number, b: number) => Math.round((f * alpha + b * (1 - alpha)) * 255) / 255;
    return { r: channel(fg.r, bg.r), g: channel(fg.g, bg.g), b: channel(fg.b, bg.b) };
}

function relativeLuminance({ r, g, b }: Rgb): number {
    const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function ratio(a: Rgb, b: Rgb): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

const THEMES = [
    ['light', webLight],
    ['dark', webDarkEffective]
] as const;

/** Table cells sit on the card; the hovered row repaints to `--surface-warm`. */
const SURFACES = ['core-card', 'surface-warm'] as const;

const cases = THEMES.flatMap(([themeName, theme]) =>
    SURFACES.map((surface) => ({ themeName, theme, surface }))
);

const ink = (theme: Theme, token: string): Rgb => toSrgb(oklchToken(theme, token));

describe('HOS-1766 plan comparison table clears WCAG AA', () => {
    describe('check icon and "Ilimitado" value', () => {
        it.each(cases)('--hospeda-forest-link clears AA text on --$surface ($themeName)', ({
            theme,
            surface
        }) => {
            expect(
                ratio(ink(theme, 'hospeda-forest-link'), ink(theme, surface))
            ).toBeGreaterThanOrEqual(AA_TEXT);
        });

        it.each(
            cases
        )('--brand-tertiary (the retired ink) fails even the icon floor on --$surface ($themeName)', ({
            theme,
            surface
        }) => {
            expect(ratio(ink(theme, 'brand-tertiary'), ink(theme, surface))).toBeLessThan(
                AA_GRAPHIC
            );
        });
    });

    describe('plan price in the header', () => {
        it.each(
            THEMES
        )('--brand-accent-text clears AA text on --core-card (%s)', (_name, theme) => {
            expect(
                ratio(ink(theme, 'brand-accent-text'), ink(theme, 'core-card'))
            ).toBeGreaterThanOrEqual(AA_TEXT);
        });

        it('--brand-accent (the retired ink) fails AA text on --core-card in light', () => {
            expect(ratio(ink(webLight, 'brand-accent'), ink(webLight, 'core-card'))).toBeLessThan(
                AA_TEXT
            );
        });
    });

    describe('"Próximamente" chip on the --brand-primary-a15 tint', () => {
        it.each(
            cases
        )('--core-foreground clears AA text on the tint over --$surface ($themeName)', ({
            theme,
            surface
        }) => {
            const tint = composite({
                fg: ink(theme, 'brand-primary'),
                bg: ink(theme, surface),
                alpha: CHIP_ALPHA
            });

            expect(ratio(ink(theme, 'core-foreground'), tint)).toBeGreaterThanOrEqual(AA_TEXT);
        });

        it('--brand-accent (the retired ink) fails AA text on the tint in light', () => {
            const tint = composite({
                fg: ink(webLight, 'brand-primary'),
                bg: ink(webLight, 'core-card'),
                alpha: CHIP_ALPHA
            });

            expect(ratio(ink(webLight, 'brand-accent'), tint)).toBeLessThan(AA_TEXT);
        });
    });

    describe('group header band', () => {
        it.each(
            THEMES
        )('--brand-primary-text clears AA text on --surface-warm (%s)', (_name, theme) => {
            expect(
                ratio(ink(theme, 'brand-primary-text'), ink(theme, 'surface-warm'))
            ).toBeGreaterThanOrEqual(AA_TEXT);
        });

        it('--brand-primary (the retired ink) fails AA text on --surface-warm in light', () => {
            expect(
                ratio(ink(webLight, 'brand-primary'), ink(webLight, 'surface-warm'))
            ).toBeLessThan(AA_TEXT);
        });
    });

    describe('inks that were already fine, pinned so a token edit cannot regress them', () => {
        it.each(
            cases
        )('--core-foreground (labels, plan name, limit values) clears AA on --$surface ($themeName)', ({
            theme,
            surface
        }) => {
            expect(
                ratio(ink(theme, 'core-foreground'), ink(theme, surface))
            ).toBeGreaterThanOrEqual(AA_TEXT);
        });

        it.each(
            cases
        )('--core-muted-foreground (period, row description, note) clears AA on --$surface ($themeName)', ({
            theme,
            surface
        }) => {
            expect(
                ratio(ink(theme, 'core-muted-foreground'), ink(theme, surface))
            ).toBeGreaterThanOrEqual(AA_TEXT);
        });
    });

    describe('"not included" minus glyph', () => {
        const glyph = (theme: Theme, opacity: number): number => {
            const card = ink(theme, 'core-card');
            return ratio(
                composite({ fg: ink(theme, 'core-muted-foreground'), bg: card, alpha: opacity }),
                card
            );
        };

        it.each(
            THEMES
        )('at the new opacity it clears the graphical-object floor on --core-card (%s)', (_name, theme) => {
            expect(glyph(theme, NOT_INCLUDED_OPACITY)).toBeGreaterThanOrEqual(AA_GRAPHIC);
        });

        it.each(THEMES)('at the retired opacity it did not (%s)', (_name, theme) => {
            expect(glyph(theme, NOT_INCLUDED_OPACITY_RETIRED)).toBeLessThan(AA_GRAPHIC);
        });
    });
});
