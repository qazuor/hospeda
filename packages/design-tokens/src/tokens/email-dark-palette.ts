/**
 * @file tokens/email-dark-palette.ts
 * @description HOS-2565 PR-4 — Dark-mode overrides for the USER email layout.
 *
 * Unlike {@link emailPalette}, these values are NOT derived from brand tokens.
 * The owner chose the look Gmail produces when it force-inverts the light email,
 * so the clients that honour `prefers-color-scheme: dark` (Apple Mail, Outlook
 * for Mac, some webmails) render the same thing Gmail users already see. Each
 * value was sampled from that Gmail render of the approved mockup
 * (`mockup-dark-gmail.png`, 2026-11-23). The success and danger callouts did not
 * appear in the mockup; they follow the same recipe (a near-black tint of the
 * tone, light tinted text).
 *
 * They are only ever emitted inside the layout's single `@media
 * (prefers-color-scheme: dark)` block, never as inline styles.
 */

/** Dark-mode colors of the user email layout, as lowercase `#rrggbb` literals. */
export const emailDarkPalette = {
    /** Page behind the card. */
    pageBackground: '#080d12',
    /** Card surface (pure near-black, as Gmail renders it). */
    surface: '#000000',
    /** Body copy. */
    text: '#cccccc',
    /** Headings and bold text. */
    heading: '#fcfcfc',
    /** Secondary copy. */
    mutedText: '#8e8e8e',
    /** Body links. */
    link: '#8dccff',
    /** The live "hospeda" wordmark (owner: white in dark mode). */
    wordmark: '#ffffff',
    /** Any other inline-tinted box in a template (receipt cards, list items). */
    tintedBox: '#0a0a0a',
    /** Hairlines inside cards. */
    border: '#212121',
    calloutInfoBackground: '#0c1d37',
    calloutInfoText: '#d0eaff',
    calloutInfoBorder: '#3d8afe',
    calloutSuccessBackground: '#04210f',
    calloutSuccessText: '#c6ecd2',
    calloutSuccessBorder: '#33aa5f',
    calloutWarningBackground: '#291300',
    calloutWarningText: '#eadcba',
    calloutWarningBorder: '#daa500',
    calloutDangerBackground: '#2e0700',
    calloutDangerText: '#f6d2cc',
    calloutDangerBorder: '#ff5a4e',
    /** Option card body. */
    optionBackground: '#000000',
    optionSuccessBand: '#001203',
    optionSuccessBandText: '#33aa5f',
    optionInfoBand: '#00121a',
    optionInfoBandText: '#4bbbd5',
    buttonPrimaryBackground: '#33aa5f',
    buttonPrimaryText: '#000000',
    buttonSecondaryBackground: '#00121a',
    buttonSecondaryText: '#75cbe0',
    buttonSecondaryBorder: '#009fc1',
    /** Footer band. */
    footerBackground: '#060f1b',
    footerText: '#fcfcfc',
    footerMutedText: '#8b97a4',
    footerLink: '#8dccff',
    footerRule: '#0e253c',
    /** "Nuestros canales" cards. */
    channelBackground: '#000000',
    channelText: '#b5b5b5',
    channelLink: '#33aa5f'
} as const;

/** Role names of {@link emailDarkPalette}. */
export type EmailDarkPaletteRole = keyof typeof emailDarkPalette;
