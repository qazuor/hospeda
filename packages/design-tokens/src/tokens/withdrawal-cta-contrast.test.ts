/**
 * @file withdrawal-cta-contrast.test.ts
 * @description WCAG contrast guard for the withdrawal CTA (HOS-1752).
 *
 * The public right-of-withdrawal page (`/{lang}/legal/arrepentimiento/`) renders
 * `.withdrawal-cta` as `--brand-accent-text` ink on a `--brand-accent` fill. That
 * ink is the orange meant for TEXT on LIGHT surfaces, so on an orange fill it
 * measured 1.60:1 in light and 1.00:1 in dark — invisible, on a button the law
 * (Res. 424/2020) requires to be clearly readable. The fix repoints the ink at
 * `--surface-dark`, an existing token that is dark in BOTH themes.
 *
 * This file asserts the PREMISE that licenses that choice, because a ratio
 * quoted in a CSS comment is not evidence unless something recomputes it:
 *
 *   1. `--surface-dark` clears AA as normal-size text on `--brand-accent` in
 *      both themes, including the `:hover` state, which darkens the fill with
 *      `filter: brightness(0.94)`.
 *   2. The old pairing does NOT — which is why the repoint was necessary.
 *
 * Both themes are asserted for every pairing: in dark the old pairing is 1:1,
 * so a guard that checked only light would still have caught it, but not the
 * other way around, and the chosen pair has to hold in both.
 *
 * The ratio math is the WCAG 2.1 relative-luminance formula over gamut-mapped,
 * 8-bit-quantised sRGB — the same pipeline `generators/srgb.ts` uses to emit the
 * sRGB fallbacks, so what is measured here is what a browser paints. The
 * helpers are copied from `green-text-contrast.test.ts` deliberately, exactly
 * as that file copied them from `channel-contrast.test.ts`: sharing them would
 * couple unrelated guards, and either could then be weakened by a change aimed
 * at the other.
 *
 * @module tokens/withdrawal-cta-contrast
 */

import { clampChroma, converter } from 'culori';
import { describe, expect, it } from 'vitest';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';

/** WCAG 2.1 AA minimum for normal-size text (< 18.66px bold, < 24px regular). */
const AA_NORMAL = 4.5;

/** The CTA declares no font-size, so it inherits body text: normal size, 4.5:1. */
const HOVER_BRIGHTNESS = 0.94;

const toRgb = converter('rgb');

/**
 * Dark mode overrides a SUBSET of `:root`; anything web-dark.ts omits is
 * inherited through the cascade. Resolving a dark pairing therefore means
 * layering the two records, exactly as the browser does.
 */
const webDarkEffective: Theme = { ...webLight, ...webDark };

/** Narrows a theme value to an OKLCH triple (vs. a raw CSS string). */
function isOklch(value: ThemeValue | undefined): value is OKLCH {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as OKLCH).l === 'number' &&
        typeof (value as OKLCH).c === 'number' &&
        typeof (value as OKLCH).h === 'number'
    );
}

/** Reads a token that must be a literal OKLCH triple, failing loudly if not. */
function oklchToken(theme: Theme, token: string): OKLCH {
    const value = theme[token];
    if (!isOklch(value)) {
        throw new Error(
            `--${token} must be a literal OKLCH triple to be contrast-checked, got: ${JSON.stringify(value)}`
        );
    }
    return value;
}

interface Rgb {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

/**
 * sRGB channels in [0, 1] after CSS Color 4 gamut mapping toward sRGB, then
 * QUANTIZED to 8 bits — a browser composites 8-bit channels, so the unquantized
 * float ratio is not the ratio a user experiences.
 */
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

/**
 * `filter: brightness(0.94)` multiplies every sRGB channel by the factor and
 * quantizes back to 8 bits, which is the fill a user sees while hovering.
 */
function brightness({ r, g, b }: Rgb, factor: number): Rgb {
    const channel = (value: number) =>
        Math.round(Math.max(0, Math.min(1, value * factor)) * 255) / 255;
    return { r: channel(r), g: channel(g), b: channel(b) };
}

/** WCAG 2.1 relative luminance of an sRGB triple in [0, 1]. */
function relativeLuminance({ r, g, b }: Rgb): number {
    const linearize = (channel: number) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.1 contrast ratio between two sRGB triples, rounded to 2 decimals. */
function contrastRatioRgb(a: Rgb, b: Rgb): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** WCAG 2.1 contrast ratio between two OKLCH values, rounded to 2 decimals. */
function contrastRatio(a: OKLCH, b: OKLCH): number {
    return contrastRatioRgb(toSrgb(a), toSrgb(b));
}

const THEMES = [
    ['light', webLight],
    ['dark', webDarkEffective]
] as const;

function ctaPair(theme: Theme): { ink: Rgb; fill: Rgb } {
    return {
        ink: toSrgb(oklchToken(theme, 'surface-dark')),
        fill: toSrgb(oklchToken(theme, 'brand-accent'))
    };
}

describe('HOS-1752 — the withdrawal CTA clears WCAG AA in both themes', () => {
    it.each(
        THEMES
    )('TEST:1752:1 --surface-dark ink clears AA on --brand-accent in the %s theme', (_name, theme) => {
        const ratio = contrastRatio(
            oklchToken(theme, 'surface-dark'),
            oklchToken(theme, 'brand-accent')
        );

        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(
        THEMES
    )('TEST:1752:2 the :hover fill (brightness(0.94)) still clears AA in the %s theme', (_name, theme) => {
        const { ink, fill } = ctaPair(theme);
        const hoverFill = brightness(fill, HOVER_BRIGHTNESS);

        expect(contrastRatioRgb(ink, hoverFill)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    describe('the old pairing is the reason this change was necessary', () => {
        it.each(
            THEMES
        )('TEST:1752:1 premise: --brand-accent-text fails AA on --brand-accent in the %s theme', (_name, theme) => {
            const ratio = contrastRatio(
                oklchToken(theme, 'brand-accent-text'),
                oklchToken(theme, 'brand-accent')
            );

            expect(ratio).toBeLessThan(AA_NORMAL);
        });

        it('premise: white --accent-foreground also fails AA on the light fill', () => {
            // In dark `--accent-foreground` is near-black and happens to pass;
            // the light theme is the one that rules it out as a replacement.
            const ratio = contrastRatio(
                oklchToken(webLight, 'accent-foreground'),
                oklchToken(webLight, 'brand-accent')
            );

            expect(ratio).toBeLessThan(AA_NORMAL);
        });
    });

    it('holds the measured ratios the CSS comment quotes', () => {
        // Quoted in `index.astro` above `.withdrawal-cta`. Asserting the exact
        // numbers (not just the floor) keeps that comment honest: a token
        // re-tune that still cleared 4.5:1 would leave the comment describing a
        // page that no longer exists.
        const light = ctaPair(webLight);
        const dark = ctaPair(webDarkEffective);

        expect({
            lightOldInk: contrastRatio(
                oklchToken(webLight, 'brand-accent-text'),
                oklchToken(webLight, 'brand-accent')
            ),
            darkOldInk: contrastRatio(
                oklchToken(webDarkEffective, 'brand-accent-text'),
                oklchToken(webDarkEffective, 'brand-accent')
            ),
            lightAccentForeground: contrastRatio(
                oklchToken(webLight, 'accent-foreground'),
                oklchToken(webLight, 'brand-accent')
            ),
            lightInk: contrastRatioRgb(light.ink, light.fill),
            darkInk: contrastRatioRgb(dark.ink, dark.fill),
            lightHover: contrastRatioRgb(light.ink, brightness(light.fill, HOVER_BRIGHTNESS)),
            darkHover: contrastRatioRgb(dark.ink, brightness(dark.fill, HOVER_BRIGHTNESS))
        }).toEqual({
            lightOldInk: 1.59,
            darkOldInk: 1,
            lightAccentForeground: 2.75,
            lightInk: 6.94,
            darkInk: 7.1,
            lightHover: 6.19,
            darkHover: 6.29
        });
    });
});
