/**
 * @file tokens/email-dark-palette.ts
 * @description HOS-2565 PR-4 — Dark-mode overrides for the USER email layout.
 *
 * Unlike {@link emailPalette}, these values are NOT derived from brand tokens.
 * They are the dark slate palette of the approved mockup's own
 * `@media (prefers-color-scheme: dark)` block, which the owner chose on
 * 2026-11-23 (the Apple Mail render, rightmost panel of `mockup-dark-compare.png`)
 * over Gmail's forced inversion. The success and danger callouts did not appear in
 * the mockup; they follow the same recipe (a dark tint of the tone, light tinted
 * text). Callout left borders and the primary button keep their light-mode colors,
 * as in the mockup.
 *
 * They are only ever emitted inside the layout's single `@media
 * (prefers-color-scheme: dark)` block, never as inline styles.
 */

/** Dark-mode colors of the user email layout, as lowercase `#rrggbb` literals. */
export const emailDarkPalette = {
    /** Page behind the card. */
    pageBackground: '#0b0f14',
    /** Card surface. */
    surface: '#141a22',
    /** Body copy. */
    text: '#d5dbe3',
    /** Headings and bold text. */
    heading: '#ffffff',
    /** Secondary copy. */
    mutedText: '#9aa5b1',
    /** Body links. */
    link: '#8cbcff',
    /** The live "hospeda" wordmark (owner: white in dark mode). */
    wordmark: '#ffffff',
    /** Any other inline-tinted box in a template (receipt cards, list items). */
    tintedBox: '#1a212b',
    /** Hairlines inside cards. */
    border: '#2e3744',
    calloutInfoBackground: '#10264a',
    calloutInfoText: '#d4e5ff',
    calloutInfoRule: '#2a4a7c',
    calloutSuccessBackground: '#0e3a20',
    calloutSuccessText: '#c6f0d3',
    calloutWarningBackground: '#3a2c00',
    calloutWarningText: '#ffe9bd',
    calloutDangerBackground: '#4a1410',
    calloutDangerText: '#ffd5cf',
    /** Option card body and border. */
    optionBackground: '#1a212b',
    optionBorder: '#2e3744',
    optionSuccessBand: '#0e3a20',
    optionSuccessBandText: '#6fe39a',
    optionInfoBand: '#053847',
    optionInfoBandText: '#6fd8f0',
    buttonSecondaryBackground: '#053847',
    buttonSecondaryText: '#9be7f7',
    /** Footer band. */
    footerBackground: '#182639',
    footerText: '#ffffff',
    footerMutedText: '#9aa5b1',
    footerLink: '#8cbcff',
    footerRule: '#2c3f5c',
    /** "Nuestros canales" cards. */
    channelBackground: '#20304a',
    channelText: '#d5dbe3',
    channelLink: '#5fd394'
} as const;

/** Role names of {@link emailDarkPalette}. */
export type EmailDarkPaletteRole = keyof typeof emailDarkPalette;
