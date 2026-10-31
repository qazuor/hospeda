/**
 * @file account-button-contrast.test.ts
 * @description WCAG contrast guard for the /mi-cuenta button variants in dark
 * mode (HOS-1942).
 *
 * Measured on staging: the compact danger button's label was 3.37:1 (needs
 * 4.5:1) because it used the FILL token `--destructive` as text, and the ghost
 * button's edge was 1.61:1 (needs 3:1, WCAG 1.4.11) because it used the
 * card-hairline `--border`. The fix points the label/edge at
 * `--destructive-text` and `--core-muted-foreground`.
 *
 * The ratio math is the same 8-bit-quantised WCAG pipeline as the sibling
 * `withdrawal-cta-contrast.test.ts`; the helpers are copied on purpose so
 * neither guard can be weakened by a change aimed at the other.
 *
 * @module tokens/account-button-contrast
 */

import { clampChroma, converter } from 'culori';
import { describe, expect, it } from 'vitest';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const toRgb = converter('rgb');
const dark: Theme = { ...webLight, ...webDark };

function oklchToken(theme: Theme, token: string): OKLCH {
    const value: ThemeValue | undefined = theme[token];
    if (typeof value !== 'object' || value === null) {
        throw new Error(`--${token} must be a literal OKLCH triple, got ${JSON.stringify(value)}`);
    }
    return value as OKLCH;
}

function luminance(value: OKLCH): number {
    const mapped = clampChroma(
        { mode: 'oklch', l: value.l, c: value.c, h: value.h },
        'oklch',
        'rgb'
    );
    const rgb = toRgb(mapped);
    const lin = (channel: number | undefined) => {
        const q = Math.round(Math.max(0, Math.min(1, channel ?? 0)) * 255) / 255;
        return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(rgb?.r) + 0.7152 * lin(rgb?.g) + 0.0722 * lin(rgb?.b);
}

function ratio(a: string, b: string, theme: Theme = dark): number {
    const la = luminance(oklchToken(theme, a));
    const lb = luminance(oklchToken(theme, b));
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Surfaces an account button can sit on, lightest-looking last. */
const SURFACES = ['core-background', 'surface-warm', 'core-card', 'surface-elevated'] as const;

describe('HOS-1942 - /mi-cuenta buttons in dark mode', () => {
    it.each(SURFACES)('--destructive-text label clears 4.5:1 on --%s', (surface) => {
        expect(ratio('destructive-text', surface)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(SURFACES)('ghost edge (--core-muted-foreground) clears 3:1 on --%s', (surface) => {
        expect(ratio('core-muted-foreground', surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it('premise: the fill token --destructive fails 4.5:1 as text on the card', () => {
        expect(ratio('destructive', 'core-card')).toBeLessThan(AA_TEXT);
    });

    it('premise: the hairline --border fails 3:1 as a button edge on the card', () => {
        expect(ratio('border', 'core-card')).toBeLessThan(AA_NON_TEXT);
    });

    it('does not change the light theme: --destructive-text equals --destructive', () => {
        expect(oklchToken(webLight, 'destructive-text')).toEqual(
            oklchToken(webLight, 'destructive')
        );
    });
});
