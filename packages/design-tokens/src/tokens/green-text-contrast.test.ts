/**
 * @file green-text-contrast.test.ts
 * @description WCAG contrast guard for green TEXT on the pricing surfaces (HOS-943).
 *
 * The "Ahorrá hasta N%" badge inside the monthly/annual toggle shipped as
 * `--success` ink on a 16% `--success` tint. axe measured 2.89:1 in light and
 * 4.13:1 in dark. The badge is 12px bold, and AA's large-text exemption starts
 * at 18.66px bold, so its floor is 4.5:1 — not 3:1.
 *
 * The fix repoints the ink at `--hospeda-forest-link`, SPEC-308's AA-safe green
 * TEXT step (the role `--brand-accent-text` plays for orange), and drops the
 * fill. This file asserts the PREMISE that licenses that choice, because a
 * ratio quoted in a CSS comment is not evidence unless something recomputes it:
 *
 *   1. `--hospeda-forest-link` clears AA as normal-size text on both pricing
 *      surfaces, in both themes.
 *   2. `--success` does NOT — which is why the repoint was necessary rather
 *      than cosmetic, and why "just remove the background" was not a fix.
 *
 * BOTH themes are asserted for every pairing, and that is the point rather than
 * thoroughness for its own sake: the original regression PASSED in dark
 * (4.13:1) and failed only in light, so a guard that checked one theme would
 * have certified it.
 *
 * BOTH backgrounds are asserted for the same reason. The badge lives inside the
 * "Anual" radio, which is `--surface-warm` while unselected and `--core-card`
 * once selected. axe only ever sampled the unselected state, because that is
 * the one a page renders on load.
 *
 * The ratio math is the WCAG 2.1 relative-luminance formula over gamut-mapped,
 * 8-bit-quantised sRGB — the same pipeline `generators/srgb.ts` uses to emit the
 * sRGB fallbacks, so what is measured here is what a browser paints. It is
 * copied from `channel-contrast.test.ts` deliberately: sharing the helpers would
 * couple two unrelated guards, and either could then be weakened by a change
 * aimed at the other.
 *
 * @module tokens/green-text-contrast
 */

import { clampChroma, converter } from 'culori';
import { describe, expect, it } from 'vitest';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';

/** WCAG 2.1 AA minimum for normal-size text (< 18.66px bold, < 24px regular). */
const AA_NORMAL = 4.5;

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

/**
 * sRGB channels in [0, 1] after CSS Color 4 gamut mapping toward sRGB, then
 * QUANTIZED to 8 bits — a browser composites 8-bit channels, so the unquantized
 * float ratio is not the ratio a user experiences.
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

/**
 * The surfaces the saving badge and the promo trial pill actually sit on.
 * `--surface-warm` is the toggle track (annual unselected); `--core-card` is
 * both the selected radio's fill and the plan card.
 */
const SURFACES = ['surface-warm', 'core-card'] as const;

const THEMES = [
    ['light', webLight],
    ['dark', webDarkEffective]
] as const;

describe('HOS-943 — green text on the pricing surfaces clears WCAG AA', () => {
    describe('--hospeda-forest-link is the ink the badge and the promo pill use', () => {
        it.each(
            THEMES.flatMap(([themeName, theme]) =>
                SURFACES.map((surface) => ({ themeName, theme, surface }))
            )
        )('clears AA on --$surface in the $themeName theme', ({ theme, surface }) => {
            const ratio = contrastRatio(
                oklchToken(theme, 'hospeda-forest-link'),
                oklchToken(theme, surface)
            );

            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it('holds the measured ratios the CSS comment quotes', () => {
            // Quoted in `PricingCardsGrid.astro` above `.pricing-toggle__badge`.
            // Asserting the exact numbers (not just the floor) is what keeps
            // that comment honest: a token re-tune that still cleared 4.5:1
            // would leave the comment describing a page that no longer exists.
            expect({
                lightTrack: contrastRatio(
                    oklchToken(webLight, 'hospeda-forest-link'),
                    oklchToken(webLight, 'surface-warm')
                ),
                lightSelected: contrastRatio(
                    oklchToken(webLight, 'hospeda-forest-link'),
                    oklchToken(webLight, 'core-card')
                ),
                darkTrack: contrastRatio(
                    oklchToken(webDarkEffective, 'hospeda-forest-link'),
                    oklchToken(webDarkEffective, 'surface-warm')
                ),
                darkSelected: contrastRatio(
                    oklchToken(webDarkEffective, 'hospeda-forest-link'),
                    oklchToken(webDarkEffective, 'core-card')
                )
            }).toEqual({
                lightTrack: 4.88,
                lightSelected: 5.65,
                darkTrack: 6.82,
                darkSelected: 6.41
            });
        });
    });

    describe('--success is NOT usable as normal-size text here', () => {
        // The premise that licenses the repoint. If a future tune ever lifted
        // `--success` past 4.5:1 on both light surfaces this turns red, and the
        // correct response is to delete this block — not to widen it.
        it.each(
            SURFACES
        )('fails AA on --%s in the LIGHT theme, bare and with no tint behind it', (surface) => {
            const ratio = contrastRatio(
                oklchToken(webLight, 'success'),
                oklchToken(webLight, surface)
            );

            expect(ratio).toBeLessThan(AA_NORMAL);
        });

        it('passes in DARK on both surfaces — which is why one theme proves nothing', () => {
            for (const surface of SURFACES) {
                const ratio = contrastRatio(
                    oklchToken(webDarkEffective, 'success'),
                    oklchToken(webDarkEffective, surface)
                );

                expect(ratio, surface).toBeGreaterThanOrEqual(AA_NORMAL);
            }
        });

        it('cannot be rescued by inverting to a solid fill either', () => {
            // The obvious repair — swap ink and fill, since `--success` and
            // `--success-foreground` are nominally a designed pair — measures
            // 3.9:1 in light. It is recorded here because it is the fix a
            // reader of this file is most likely to reach for next.
            const light = contrastRatio(
                oklchToken(webLight, 'success-foreground'),
                oklchToken(webLight, 'success')
            );
            const dark = contrastRatio(
                oklchToken(webDarkEffective, 'success-foreground'),
                oklchToken(webDarkEffective, 'success')
            );

            expect(light).toBeLessThan(AA_NORMAL);
            expect(dark).toBeGreaterThanOrEqual(AA_NORMAL);
        });
    });

    describe('the badge outline carries its own weight', () => {
        it('clears the 3:1 non-text floor at full currentColor, unlike a 60% mix', () => {
            // `border: 1px solid currentColor` paints the ink itself, so the
            // outline inherits the text ratio (4.88:1 worst) and clears WCAG
            // 1.4.11's 3:1. The trial pill's `currentColor 60%` would composite
            // to 2.47:1 against the light track — the reason this rule does not
            // simply copy that alpha.
            const NON_TEXT_FLOOR = 3;
            const worstInkRatio = Math.min(
                ...THEMES.flatMap(([, theme]) =>
                    SURFACES.map((surface) =>
                        contrastRatio(
                            oklchToken(theme, 'hospeda-forest-link'),
                            oklchToken(theme, surface)
                        )
                    )
                )
            );

            expect(worstInkRatio).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
        });
    });
});
