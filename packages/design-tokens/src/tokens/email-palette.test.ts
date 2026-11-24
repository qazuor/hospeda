/**
 * @file tokens/email-palette.test.ts
 * @description HOS-2519 AC-1.4 — every `emailPalette` literal is the hex of
 * the sRGB conversion of its source token, so the email palette cannot drift
 * from the brand tokens.
 */

import { describe, expect, it } from 'vitest';
import { formatSRGB } from '../generators/srgb.js';
import {
    accent,
    brandSecondary,
    brandTertiary,
    cyan,
    danger,
    forest,
    info,
    neutral,
    type OKLCH,
    river,
    sky,
    success,
    teal,
    warning
} from './colors.js';
import { type EmailPaletteRole, emailPalette } from './email-palette.js';

/**
 * Converts the `rgb(R G B)` string emitted by `formatSRGB` to `#rrggbb`.
 */
function rgbToHex({ rgb }: { readonly rgb: string }): string {
    const match = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(rgb);
    if (!match) {
        throw new Error(`Unexpected sRGB format: ${rgb}`);
    }
    const channels = match.slice(1, 4).map((channel) => Number(channel));
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Source token of each email role (mirrors the JSDoc in email-palette.ts). */
const SOURCE_TOKENS: Readonly<Record<EmailPaletteRole, OKLCH>> = {
    pageBackground: neutral[50],
    surface: { l: 1, c: 0, h: 0 },
    brand: river[500],
    brandStrong: river[700],
    text: neutral[900],
    mutedText: neutral[500],
    border: neutral[200],
    link: river[600],
    calloutInfoBackground: info[100],
    calloutInfoBorder: info[500],
    calloutInfoText: info[800],
    calloutSuccessBackground: success[100],
    calloutSuccessBorder: success[500],
    calloutSuccessText: success[800],
    calloutWarningBackground: warning[100],
    calloutWarningBorder: warning[500],
    calloutWarningText: warning[800],
    calloutDangerBackground: danger[100],
    calloutDangerBorder: danger[500],
    calloutDangerText: danger[800],
    buttonPrimary: forest[500],
    buttonPrimaryText: { l: 1, c: 0, h: 0 },
    buttonSecondaryBackground: cyan[100],
    buttonSecondaryBorder: cyan[500],
    buttonSecondaryText: cyan[700],
    accentTeal: teal[500],
    accentOrange: accent[500],
    userPageBackground: brandSecondary,
    userFooterBackground: sky[100],
    userFooterMutedText: neutral[600],
    userFooterRule: sky[300],
    optionSuccessStripe: success[500],
    optionSuccessBand: brandTertiary,
    optionSuccessBandText: success[600],
    optionInfoStripe: cyan[500],
    optionInfoBand: cyan[100],
    optionInfoBandText: cyan[700]
};

describe('emailPalette', () => {
    it('declares exactly the roles listed in SOURCE_TOKENS', () => {
        // Arrange
        const expected = Object.keys(SOURCE_TOKENS).sort();

        // Act
        const actual = Object.keys(emailPalette).sort();

        // Assert
        expect(actual).toEqual(expected);
    });

    it.each(Object.entries(emailPalette))('%s is a lowercase #rrggbb literal', (_role, value) => {
        // Assert
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
    });

    it.each(
        Object.keys(SOURCE_TOKENS) as EmailPaletteRole[]
    )('%s equals the hex of formatSRGB(<source token>)', (role) => {
        // Arrange
        const source = SOURCE_TOKENS[role];

        // Act
        const expected = rgbToHex({ rgb: formatSRGB(source) });

        // Assert
        expect(emailPalette[role]).toBe(expected);
    });
});
