/**
 * @file tokens/email-palette.ts
 * @description HOS-2519 D3 — Email-safe palette as hex literals.
 *
 * Email clients do not parse `oklch()`, CSS custom properties or the CSS
 * Color 4 `rgb(R G B)` space syntax (Outlook desktop in particular), so the
 * transactional email layout needs plain `#rrggbb` literals in inline styles.
 *
 * Each role is the sRGB conversion of one design token, written as a literal
 * so that runtime consumers (`@repo/email`) never pull `culori`. The colocated
 * test (`email-palette.test.ts`) recomputes every value from its source token
 * with the build-time converter and fails on drift, so changing a brand shade
 * without updating this file breaks CI instead of silently diverging.
 */

/**
 * Hex palette used by the shared transactional email layout.
 *
 * Every value is lowercase `#rrggbb`. The JSDoc of each role names its source
 * token; the test asserts the literal equals that token's sRGB conversion.
 */
export const emailPalette = {
    /** Page background behind the 600px card. Source: `neutral[50]`. */
    pageBackground: '#fafafa',
    /** Card / header surface. Source: pure white (OKLCH `l: 1, c: 0`). */
    surface: '#ffffff',
    /** Brand accent bar and primary brand color. Source: `river[500]`. */
    brand: '#3885f9',
    /** Strong brand color for the text wordmark fallback. Source: `river[700]`. */
    brandStrong: '#003987',
    /** Primary text. Source: `neutral[900]`. */
    text: '#030303',
    /** Secondary text (tagline, footer description). Source: `neutral[500]`. */
    mutedText: '#717171',
    /** Dividers and borders. Source: `neutral[200]`. */
    border: '#dedede',
    /** Footer links. Source: `river[600]`. */
    link: '#1c5dbf'
} as const;

/** Role names of {@link emailPalette}. */
export type EmailPaletteRole = keyof typeof emailPalette;
