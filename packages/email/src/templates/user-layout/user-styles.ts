/**
 * The single `<style>` block of the USER layout (HOS-2565 PR-4): the shared button
 * rule, a few narrow-screen rules and ONE `prefers-color-scheme: dark` block.
 *
 * Every rule is an enhancement. With the block stripped (some Gmail account types,
 * older clients) the mail is still the correct light layout from inline styles.
 * Dark colors come from `emailDarkPalette`, the mockup's own dark block that the
 * owner approved (Apple Mail look), never from Gmail's inversion. There is no
 * `u + .body` Gmail trick on purpose: it erased the wordmark in Gmail light mode.
 *
 * Class names are short (`hd-*`) because the block ships in every user mail.
 *
 * @module templates/user-layout/user-styles
 */

import { emailDarkPalette as dark, emailPalette } from '@repo/design-tokens';
import {
    EMAIL_BUTTON_CLASS,
    EMAIL_BUTTON_MEDIA_RULE,
    EMAIL_BUTTON_SECONDARY_CLASS
} from '../../components/button.js';

/** Class names the user layout and the shared components put on their elements. */
export const EMAIL_USER_CLASSES = {
    page: 'hd-page',
    card: 'hd-card',
    surface: 'hd-surface',
    padded: 'hd-px',
    wordmark: 'hd-word',
    muted: 'hd-muted',
    illustration: 'hd-ill',
    footer: 'hd-foot',
    footerLink: 'hd-flink',
    channel: 'hd-chan',
    channelLink: 'hd-clink',
    rule: 'hd-rule',
    stack: 'hd-stack',
    spacer: 'hd-spacer',
    optionCard: 'hd-opt',
    optionBandSuccess: 'hd-band-s',
    optionBandInfo: 'hd-band-i',
    buttonSecondary: EMAIL_BUTTON_SECONDARY_CLASS,
    calloutInfo: 'hd-co-info',
    calloutSuccess: 'hd-co-success',
    calloutWarning: 'hd-co-warning',
    calloutDanger: 'hd-co-danger'
} as const;

const c = EMAIL_USER_CLASSES;

/** Narrow screens: tighter side padding, stacked footer cards, smaller illustration. */
const NARROW_RULES = [
    `.${c.padded}{padding-left:20px !important;padding-right:20px !important;}`,
    `.${c.stack}{display:block !important;width:100% !important;box-sizing:border-box;}`,
    `.${c.spacer}{height:12px !important;}`,
    `.${c.illustration}{width:84px !important;height:84px !important;}`
].join('');

/**
 * Dark mode for clients that honour `prefers-color-scheme` (Apple Mail, Outlook for
 * Mac, some webmails). The card-wide rules override the templates' inline text
 * colors; the class rules after them win by order and specificity for the boxes
 * that keep a tint (callouts, option cards, buttons, footer).
 */
const DARK_RULES = [
    // React Email's <Body> moves its inline style to a wrapper table cell.
    `.${c.page},.${c.page}>table>tbody>tr>td{background-color:${dark.pageBackground} !important;}`,
    `.${c.card},.${c.card} .${c.surface}{background-color:${dark.surface} !important;color:${dark.text} !important;}`,
    `.${c.card} p,.${c.card} td,.${c.card} li,.${c.card} span{color:${dark.text} !important;}`,
    `.${c.card} h1,.${c.card} h2,.${c.card} h3,.${c.card} strong,.${c.card} b{color:${dark.heading} !important;}`,
    `.${c.card} a{color:${dark.link} !important;}`,
    `.${c.card} [style*="background-color:${emailPalette.pageBackground}"]{background-color:${dark.tintedBox} !important;border-color:${dark.border} !important;}`,
    `.${c.card} .${c.muted}{color:${dark.mutedText} !important;}`,
    `.${c.card} .${c.wordmark}{color:${dark.wordmark} !important;}`,
    `.${c.card} .${c.calloutInfo},.${c.card} .${c.calloutInfo} *{background-color:${dark.calloutInfoBackground} !important;color:${dark.calloutInfoText} !important;border-color:${dark.calloutInfoRule} !important;}`,
    `.${c.card} .${c.calloutSuccess},.${c.card} .${c.calloutSuccess} *{background-color:${dark.calloutSuccessBackground} !important;color:${dark.calloutSuccessText} !important;}`,
    `.${c.card} .${c.calloutWarning},.${c.card} .${c.calloutWarning} *{background-color:${dark.calloutWarningBackground} !important;color:${dark.calloutWarningText} !important;}`,
    `.${c.card} .${c.calloutDanger},.${c.card} .${c.calloutDanger} *{background-color:${dark.calloutDangerBackground} !important;color:${dark.calloutDangerText} !important;}`,
    `.${c.card} .${c.optionCard}{background-color:${dark.optionBackground} !important;border-left-color:${dark.optionBorder} !important;border-right-color:${dark.optionBorder} !important;border-bottom-color:${dark.optionBorder} !important;}`,
    `.${c.card} .${c.optionBandSuccess}{background-color:${dark.optionSuccessBand} !important;color:${dark.optionSuccessBandText} !important;}`,
    `.${c.card} .${c.optionBandInfo}{background-color:${dark.optionInfoBand} !important;color:${dark.optionInfoBandText} !important;}`,
    `.${c.card} a.${EMAIL_BUTTON_CLASS}{color:${emailPalette.buttonPrimaryText} !important;}`,
    `.${c.card} a.${c.buttonSecondary}{background-color:${dark.buttonSecondaryBackground} !important;color:${dark.buttonSecondaryText} !important;}`,
    `.${c.card} .${c.footer}{background-color:${dark.footerBackground} !important;}`,
    `.${c.card} .${c.footer} td,.${c.card} .${c.footer} p,.${c.card} .${c.footer} h3,.${c.card} .${c.footer} a{color:${dark.footerText} !important;}`,
    `.${c.card} .${c.footer} .${c.muted}{color:${dark.footerMutedText} !important;}`,
    `.${c.card} .${c.footer} a.${c.footerLink}{color:${dark.footerLink} !important;}`,
    `.${c.card} .${c.footer} .${c.channel},.${c.card} .${c.footer} .${c.channel} p{background-color:${dark.channelBackground} !important;color:${dark.channelText} !important;}`,
    `.${c.card} .${c.footer} a.${c.channelLink}{color:${dark.channelLink} !important;}`,
    `.${c.card} .${c.rule}{border-color:${dark.footerRule} !important;}`
].join('');

/**
 * The full content of the user layout's one `<style>` element.
 */
export const EMAIL_USER_STYLE_BLOCK = `${EMAIL_BUTTON_MEDIA_RULE}@media only screen and (max-width:480px){${NARROW_RULES}}@media (prefers-color-scheme:dark){${DARK_RULES}}`;
