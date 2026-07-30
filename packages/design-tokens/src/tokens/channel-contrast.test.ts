/**
 * @file channel-contrast.test.ts
 * @description WCAG contrast guard for the third-party channel tokens (HOS-314).
 *
 * The WhatsApp CTA shipped white text on the brand green: 1.98:1, which fails
 * WCAG AA for normal text (4.5:1) AND for large text (3:1). It is the primary
 * CTA of the HOS-19 contact feature, so this is not a cosmetic nit.
 *
 * Contrast is a property of a PAIR, which makes it exactly the kind of rule a
 * reviewer cannot check by reading one line of a diff — hence this guard. It
 * reads the values out of the theme records (what actually gets emitted to
 * `dist/tokens.css`), NOT out of the `channels` constant, so a theme that
 * re-points a token at something else is caught rather than certified.
 *
 * Dark mode is checked as its own pairing because the two halves of this token
 * family have OPPOSITE requirements, and getting either backwards reintroduces
 * a failure:
 *
 *   - `--channel-whatsapp-foreground` must NOT invert. It sits on a brand green
 *     that is identical in both themes; dark mode's near-white
 *     `--core-foreground` on that green is 1.56:1.
 *   - `--channel-whatsapp-text` MUST invert. It sits on `--surface-warm`, which
 *     flips from pale blue to navy; the light value on the navy is 2.52:1.
 *
 * The ratio math is the WCAG 2.1 relative-luminance formula over the
 * gamut-mapped sRGB values — the same `clampChroma` pipeline
 * `generators/srgb.ts` uses to emit the sRGB fallbacks, so what is measured
 * here is what a browser paints.
 *
 * @module tokens/channel-contrast
 */

import { clampChroma, converter, parse } from 'culori';
import { describe, expect, it } from 'vitest';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';

/** WCAG 2.1 AA minimum for normal-size text. */
const AA_NORMAL = 4.5;
/** WCAG 2.1 AAA minimum for normal-size text. */
const AAA_NORMAL = 7;

/** WhatsApp's canonical brand green, as published by the brand. */
const BRAND_GREEN_HEX = '#25d366';

const toRgb = converter('rgb');

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

/**
 * sRGB channels in [0, 1] after CSS Color 4 gamut mapping toward sRGB, then
 * QUANTIZED to 8 bits.
 *
 * The quantization is not cosmetic: a browser composites 8-bit channels, so the
 * unquantized float ratio is not the ratio a user experiences. The two diverge
 * by up to 0.05 here (7.44 unquantized vs 7.49 painted), which is enough to
 * make the numbers documented alongside the tokens irreproducible from this
 * guard — and a documented ratio nobody can reproduce stops being evidence.
 */
function toSrgb(value: OKLCH): { r: number; g: number; b: number } {
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

/** WCAG 2.1 relative luminance of an sRGB triple in [0, 1]. */
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
    const linearize = (channel: number) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.1 contrast ratio between two OKLCH values, rounded to 2 decimals. */
function contrastRatio(a: OKLCH, b: OKLCH): number {
    const la = relativeLuminance(toSrgb(a));
    const lb = relativeLuminance(toSrgb(b));
    const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** 0–255 integer channels, matching what `formatSRGB` emits. */
function to255(value: OKLCH): [number, number, number] {
    const { r, g, b } = toSrgb(value);
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Dark mode overrides a SUBSET of `:root`; anything web-dark.ts omits is
 * inherited through the cascade. Resolving a dark pairing therefore means
 * layering the two records, exactly as the browser does.
 */
const webDarkEffective: Theme = { ...webLight, ...webDark };

/** The tokens that describe the theme-invariant brand fill and its inks. */
const THEME_INVARIANT_TOKENS = [
    'channel-whatsapp',
    'channel-whatsapp-foreground',
    'channel-whatsapp-logo',
    'channel-whatsapp-hover'
] as const;

describe('HOS-314 — WhatsApp channel tokens clear WCAG AA', () => {
    describe('structure', () => {
        it.each([
            ...THEME_INVARIANT_TOKENS,
            'channel-whatsapp-text'
        ])('--%s is a literal OKLCH triple in the light theme', (token) => {
            expect(isOklch(webLight[token])).toBe(true);
        });

        it('the foreground is a frozen literal, decoupled from --core-foreground', () => {
            // Provenance (documented, not asserted): the value was COPIED from
            // web-light's --core-foreground, `oklch(0.2 0.02 220)`. Asserting
            // equality with that token instead would be backwards — it would
            // re-create the coupling the freeze exists to break, so an unrelated
            // tuning of --core-foreground would turn this suite red and the
            // obvious remedy would be to drag the WhatsApp ink along with it.
            // What must hold is that the value is a literal and stays this dark.
            expect(webLight['channel-whatsapp-foreground']).toEqual({
                l: 0.2,
                c: 0.02,
                h: 220
            });
        });

        it('the logo ink is white — a logotype exemption, not a contrast pairing', () => {
            // WCAG 1.4.3 exempts logotypes, so the logo-only badge keeps the
            // mark white (owner decision, HOS-314). White on the fill is 1.98:1,
            // which is exactly why this token must never reach TEXT; the web
            // static guard enumerates its single legitimate consumer.
            const logo = oklchToken(webLight, 'channel-whatsapp-logo');
            expect(logo.l).toBe(1);
            expect(logo.c).toBe(0);
        });
    });

    describe('ink on the brand fill — must be identical in both themes', () => {
        it(`clears AAA (>= ${AAA_NORMAL}:1) in light`, () => {
            const ratio = contrastRatio(
                oklchToken(webLight, 'channel-whatsapp-foreground'),
                oklchToken(webLight, 'channel-whatsapp')
            );
            expect(ratio).toBeGreaterThanOrEqual(AAA_NORMAL);
        });

        it(`the hover fill still clears AA (>= ${AA_NORMAL}:1)`, () => {
            const ratio = contrastRatio(
                oklchToken(webLight, 'channel-whatsapp-foreground'),
                oklchToken(webLight, 'channel-whatsapp-hover')
            );
            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it(`still clears AA (>= ${AA_NORMAL}:1) once dark-mode overrides are applied`, () => {
            const ratio = contrastRatio(
                oklchToken(webDarkEffective, 'channel-whatsapp-foreground'),
                oklchToken(webDarkEffective, 'channel-whatsapp')
            );
            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it.each(
            THEME_INVARIANT_TOKENS
        )('web-dark.ts does not override --%s (the brand fill has no dark variant)', (token) => {
            expect(Object.keys(webDark)).not.toContain(token);
        });
    });

    describe('number text on --surface-warm — must invert with the theme', () => {
        it(`clears AA (>= ${AA_NORMAL}:1) in light`, () => {
            const ratio = contrastRatio(
                oklchToken(webLight, 'channel-whatsapp-text'),
                oklchToken(webLight, 'surface-warm')
            );
            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it(`clears AA (>= ${AA_NORMAL}:1) in dark`, () => {
            const ratio = contrastRatio(
                oklchToken(webDarkEffective, 'channel-whatsapp-text'),
                oklchToken(webDarkEffective, 'surface-warm')
            );
            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
        });
    });

    describe('focus ring on the WhatsApp surfaces (WCAG 1.4.11, 3:1)', () => {
        // The ring is `2px solid var(--brand-primary)` with `outline-offset:
        // 2px`, so the 2px gap is filled by the block's own --surface-warm and
        // THAT is the adjacent color the ratio is measured against, not the
        // green. It passes — but by 0.08 in light, against a shared token that
        // has already been lifted twice for AA reasons (SPEC-308, BETA-126).
        // The PR's own thesis is that a pairing a reviewer cannot eyeball needs
        // a guard; this was the last pairing it asserted only in prose.
        const NON_TEXT_MIN = 3;

        // Two of the three surfaces ring with --brand-primary; the newsletter CTA
        // rings with --ring. They hold identical values in both themes today, so
        // measuring only one would be right by coincidence and would stop
        // covering that surface the moment they diverge.
        it.each([
            ['light', webLight, 'brand-primary'],
            ['light', webLight, 'ring'],
            ['dark', webDarkEffective, 'brand-primary'],
            ['dark', webDarkEffective, 'ring']
        ] as const)('%s: --%s clears 3:1 against --surface-warm', (_label, theme, token) => {
            const ratio = contrastRatio(
                oklchToken(theme, token),
                oklchToken(theme, 'surface-warm')
            );
            expect(ratio).toBeGreaterThanOrEqual(NON_TEXT_MIN);
        });
    });

    describe('the documented ratios are reproducible from here', () => {
        // The reason `toSrgb` quantizes to 8 bits. Without these pins the
        // quantization has no regression coverage at all: reverting it to raw
        // floats keeps every threshold above satisfied (9.10 >= 7, 7.38 >= 4.5,
        // 5.42 >= 4.5, 7.44 >= 4.5, 3.09 >= 3) while silently invalidating every
        // number written next to the tokens. These are the numbers a reviewer
        // reads in `colors.ts`, `web-dark.ts` and the component comments.
        it.each([
            [
                'ink on the brand fill',
                webLight,
                'channel-whatsapp-foreground',
                'channel-whatsapp',
                9.12
            ],
            [
                'ink on the hover fill',
                webLight,
                'channel-whatsapp-foreground',
                'channel-whatsapp-hover',
                7.39
            ],
            ['number text, light', webLight, 'channel-whatsapp-text', 'surface-warm', 5.42],
            ['number text, dark', webDarkEffective, 'channel-whatsapp-text', 'surface-warm', 7.49],
            ['focus ring, light', webLight, 'brand-primary', 'surface-warm', 3.08],
            ['focus ring, dark', webDarkEffective, 'brand-primary', 'surface-warm', 5.4]
        ] as const)('%s measures exactly as documented', (_label, theme, a, b, expected) => {
            expect(contrastRatio(oklchToken(theme, a), oklchToken(theme, b))).toBe(expected);
        });
    });

    describe('brand fidelity', () => {
        it(`renders within one 8-bit step per channel of ${BRAND_GREEN_HEX}`, () => {
            // The token is stored in OKLCH at 3 decimals, so it cannot hold the
            // brand hex byte-exactly; it must stay visually indistinguishable
            // from it. Pinning this is what stops an "accessibility fix" from
            // quietly walking the brand color somewhere else.
            const brand = toRgb(parse(BRAND_GREEN_HEX));
            const expected = [brand?.r ?? 0, brand?.g ?? 0, brand?.b ?? 0].map((channel) =>
                Math.round(channel * 255)
            );
            const actual = to255(oklchToken(webLight, 'channel-whatsapp'));

            for (const [index, channel] of actual.entries()) {
                expect(Math.abs(channel - (expected[index] ?? 0))).toBeLessThanOrEqual(1);
            }
        });
    });
});
