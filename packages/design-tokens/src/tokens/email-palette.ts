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
    /** Strong brand color for the header wordmark text. Source: `river[700]`. */
    brandStrong: '#003987',
    /** Primary text. Source: `neutral[900]`. */
    text: '#030303',
    /** Secondary text (tagline, footer description). Source: `neutral[500]`. */
    mutedText: '#717171',
    /** Dividers and borders. Source: `neutral[200]`. */
    border: '#dedede',
    /** Footer links. Source: `river[600]`. */
    link: '#1c5dbf',
    /**
     * Callout (HOS-2565 D3): background, 4px left border and text per tone.
     *
     * The spec proposed `[50]` backgrounds, but this scale's `[50]` shades
     * (`#fafcff`, `#f5fff6`, ...) are almost indistinguishable from the white
     * card, which defeats the point of a callout ("always a visible tinted
     * background"). Backgrounds therefore use `[100]`, and the colocated
     * contrast test also asserts they stay visibly tinted against the surface.
     */
    /** Info callout background. Source: `info[100]`. */
    calloutInfoBackground: '#d4e5ff',
    /** Info callout 4px left border. Source: `info[500]`. */
    calloutInfoBorder: '#3885f9',
    /** Info callout text. Source: `info[800]`. */
    calloutInfoText: '#001a47',
    /** Success callout background. Source: `success[100]`. */
    calloutSuccessBackground: '#b6f2c1',
    /** Success callout 4px left border. Source: `success[500]`. */
    calloutSuccessBorder: '#1b9247',
    /** Success callout text. Source: `success[800]`. */
    calloutSuccessText: '#00220a',
    /** Warning callout background. Source: `warning[100]`. */
    calloutWarningBackground: '#ffe9bd',
    /** Warning callout 4px left border. Source: `warning[500]`. */
    calloutWarningBorder: '#daa500',
    /** Warning callout text. Source: `warning[800]`. */
    calloutWarningText: '#302200',
    /** Danger callout background. Source: `danger[100]`. */
    calloutDangerBackground: '#ffd5cf',
    /** Danger callout 4px left border. Source: `danger[500]`. */
    calloutDangerBorder: '#e40016',
    /** Danger callout text. Source: `danger[800]`. */
    calloutDangerText: '#3a0001',
    /**
     * Primary button background (HOS-2565 PR-4). Source: `forest[500]`.
     *
     * The approved mockup used `success[500]` (`#1b9247`), but white 16px text on it
     * measures 4.0:1, under WCAG AA (4.5:1). `forest[500]` is the closest brand green
     * that passes (5.7:1); `success[500]` stays as the option-card stripe, which
     * carries no text.
     */
    buttonPrimary: '#007742',
    /** Primary button text. Source: pure white (OKLCH `l: 1, c: 0`). */
    buttonPrimaryText: '#ffffff',
    /** Secondary button background. Source: `cyan[100]`. */
    buttonSecondaryBackground: '#bdefff',
    /** Secondary button border. Source: `cyan[500]`. */
    buttonSecondaryBorder: '#009fc1',
    /** Secondary button text. Source: `cyan[700]` (`cyan[600]` fails AA on the background). */
    buttonSecondaryText: '#00495a',
    /** User layout (HOS-2565 PR-4): section title bar, main accent. Source: `teal[500]`. */
    accentTeal: '#1b9388',
    /** User layout: occasional section title bar accent. Source: `accent[500]`. */
    accentOrange: '#ed7b00',
    /** User layout page background behind the card. Source: `brandSecondary`. */
    userPageBackground: '#e6f4fe',
    /** User layout footer background. Source: `sky[100]`. */
    userFooterBackground: '#e6f0ff',
    /** User footer small print and channel card text. Source: `neutral[600]`. */
    userFooterMutedText: '#4d4d4d',
    /** User footer hairlines (trust strip). Source: `sky[300]`. */
    userFooterRule: '#bfd8ff',
    /** Option card "success" top stripe. Source: `success[500]`. */
    optionSuccessStripe: '#1b9247',
    /** Option card "success" label band. Source: `brandTertiary`. */
    optionSuccessBand: '#d6ebdc',
    /** Option card "success" label text. Source: `success[600]`. */
    optionSuccessBandText: '#006b2e',
    /** Option card "info" top stripe. Source: `cyan[500]`. */
    optionInfoStripe: '#009fc1',
    /** Option card "info" label band. Source: `cyan[100]`. */
    optionInfoBand: '#bdefff',
    /** Option card "info" label text. Source: `cyan[700]`. */
    optionInfoBandText: '#00495a'
} as const;

/** Role names of {@link emailPalette}. */
export type EmailPaletteRole = keyof typeof emailPalette;
