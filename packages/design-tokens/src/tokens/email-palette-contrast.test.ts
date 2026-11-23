/**
 * @file tokens/email-palette-contrast.test.ts
 * @description HOS-2565 AC-2.2 — WCAG contrast guard for the email callout and
 * button roles of {@link emailPalette}.
 *
 * Contrast is a property of a PAIR, so it cannot be judged from one line of a
 * diff. This test measures the literals that actually ship in inline styles:
 *
 *   1. each callout's text on its background is ≥ 4.5:1 (WCAG AA, normal text);
 *   2. the primary button's text on its background is ≥ 4.5:1;
 *   3. the secondary (outlined) button's text, which reuses its border color,
 *      is ≥ 4.5:1 on the white card;
 *   4. each callout background stays VISIBLY tinted against the white card
 *      (≥ 1.1:1). A `[50]` shade of this scale (for example `#fafcff`) passes
 *      every text check and is still invisible, which is the exact failure the
 *      callout exists to fix.
 *
 * The ratio is the WCAG 2.1 relative-luminance formula over the hex literals.
 * Helpers are local on purpose, as in the other `*-contrast.test.ts` guards:
 * sharing them would couple unrelated guards.
 *
 * @module tokens/email-palette-contrast
 */

import { describe, expect, it } from 'vitest';
import { emailPalette } from './email-palette.js';

/** WCAG 2.1 AA minimum for normal-size text. */
const AA_NORMAL = 4.5;

/** Minimum luminance ratio for a tint to read as "not white" on the card. */
const VISIBLE_TINT = 1.1;

const TONES = ['Info', 'Success', 'Warning', 'Danger'] as const;

/** WCAG 2.1 relative luminance of a `#rrggbb` literal. */
function luminance({ hex }: { readonly hex: string }): number {
    const [r, g, b] = [1, 3, 5].map((offset) => {
        const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` literals (order-insensitive). */
function contrast({ a, b }: { readonly a: string; readonly b: string }): number {
    const la = luminance({ hex: a });
    const lb = luminance({ hex: b });
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('emailPalette contrast (HOS-2565)', () => {
    it.each(TONES)('callout %s text on its background is at least 4.5:1', (tone) => {
        // Arrange
        const text = emailPalette[`callout${tone}Text`];
        const background = emailPalette[`callout${tone}Background`];

        // Act
        const ratio = contrast({ a: text, b: background });

        // Assert
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(TONES)('callout %s background is visibly tinted against the surface', (tone) => {
        // Arrange
        const background = emailPalette[`callout${tone}Background`];

        // Act
        const ratio = contrast({ a: background, b: emailPalette.surface });

        // Assert
        expect(ratio).toBeGreaterThanOrEqual(VISIBLE_TINT);
    });

    it('primary button text on its background is at least 4.5:1', () => {
        // Act
        const ratio = contrast({
            a: emailPalette.buttonPrimaryText,
            b: emailPalette.buttonPrimary
        });

        // Assert
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('secondary button text (its border color) on the surface is at least 4.5:1', () => {
        // Act
        const ratio = contrast({ a: emailPalette.buttonSecondaryBorder, b: emailPalette.surface });

        // Assert
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('measures a known pair correctly (sanity check of the helper)', () => {
        // Act
        const ratio = contrast({ a: '#000000', b: '#ffffff' });

        // Assert
        expect(ratio).toBeCloseTo(21, 5);
    });
});
