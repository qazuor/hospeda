/**
 * @file tokens/email-dark-palette.test.ts
 * @description HOS-2565 PR-4 — format and readability of the dark-mode email overrides.
 * The values are sampled from Gmail's inversion, not derived from tokens, so the
 * guard here is shape plus contrast of every text pair that ships.
 */

import { describe, expect, it } from 'vitest';
import { type EmailDarkPaletteRole, emailDarkPalette } from './email-dark-palette.js';

/** WCAG 2.1 relative luminance of a `#rrggbb` literal. */
function luminance({ hex }: { readonly hex: string }): number {
    const [r, g, b] = [1, 3, 5].map((offset) => {
        const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` literals. */
function contrast({ a, b }: { readonly a: string; readonly b: string }): number {
    const la = luminance({ hex: a });
    const lb = luminance({ hex: b });
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const TEXT_PAIRS: readonly (readonly [EmailDarkPaletteRole, EmailDarkPaletteRole])[] = [
    ['text', 'surface'],
    ['heading', 'surface'],
    ['mutedText', 'surface'],
    ['link', 'surface'],
    ['wordmark', 'surface'],
    ['text', 'tintedBox'],
    ['calloutInfoText', 'calloutInfoBackground'],
    ['calloutSuccessText', 'calloutSuccessBackground'],
    ['calloutWarningText', 'calloutWarningBackground'],
    ['calloutDangerText', 'calloutDangerBackground'],
    ['optionSuccessBandText', 'optionSuccessBand'],
    ['optionInfoBandText', 'optionInfoBand'],
    ['buttonPrimaryText', 'buttonPrimaryBackground'],
    ['buttonSecondaryText', 'buttonSecondaryBackground'],
    ['footerText', 'footerBackground'],
    ['footerMutedText', 'footerBackground'],
    ['footerLink', 'footerBackground'],
    ['channelText', 'channelBackground'],
    ['channelLink', 'channelBackground']
];

describe('emailDarkPalette (HOS-2565 PR-4)', () => {
    it.each(
        Object.entries(emailDarkPalette)
    )('%s is a lowercase #rrggbb literal', (_role, value) => {
        // Assert
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
    });

    it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (text, background) => {
        // Act
        const ratio = contrast({ a: emailDarkPalette[text], b: emailDarkPalette[background] });

        // Assert
        expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
});
