/**
 * The USER email footer (HOS-2565 PR-4), on a very light blue band with a wave on
 * top, in the owner-approved order:
 *
 * 1. "¿Necesitás ayuda?": help center, contact and WhatsApp;
 * 2. "Preguntas frecuentes": the help articles the mail declares (or the default set),
 *    only for account holders: the articles sit behind the login wall. Without an
 *    account, "Centro de ayuda" points at the public FAQ page instead;
 * 3. "Nuestros canales": security, web and contact cards;
 * 4. the trust strip;
 * 5. the logo and the Instagram, Facebook and X icons;
 * 6. the small print: why you get it, "Elegí qué correos recibís", the D16 account
 *    link and the copyright.
 *
 * Every link points at production (`EMAIL_PUBLIC_SITE_URL`); only images follow the
 * deployment's origin.
 *
 * @module templates/user-layout/user-footer
 */

import { Column, Row } from '@react-email/components';
import { BRAND_SOCIAL_PROFILES, BRAND_WHATSAPP_URL, type BrandSocialPlatform } from '@repo/config';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement } from 'react';
import {
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_FAQ_URL,
    EMAIL_PUBLIC_SITE_URL,
    resolveEmailAssetUrl,
    resolveEmailIsotipoUrl
} from '../../email-assets.js';
import { resolveEmailAccountLinkTarget } from './account-link.js';
import { resolveEmailHelpLinks } from './help-links.js';
import { EMAIL_USER_ASSET_PATHS } from './user-assets.js';
import { ChannelCards, FooterHeading, FooterLink, TrustStrip } from './user-footer-parts.js';
import { USER_FONT_STACK } from './user-header.js';
import { EMAIL_USER_CLASSES } from './user-styles.js';

/** Logged-in help center (account holders only). */
const EMAIL_HELP_CENTER_URL = `${EMAIL_PUBLIC_SITE_URL}/es/mi-cuenta/ayuda/`;

/** Label of the preferences link (owner wording, 2026-11-22). */
export const EMAIL_USER_PREFERENCES_LABEL = 'Elegí qué correos recibís';

/** The social profiles the email shows, in order (owner: Instagram, Facebook and X only). */
export const EMAIL_SOCIAL_PLATFORMS = [
    'instagram',
    'facebook',
    'x'
] as const satisfies readonly BrandSocialPlatform[];

const SOCIAL_DECOR: Readonly<
    Record<
        (typeof EMAIL_SOCIAL_PLATFORMS)[number],
        { readonly icon: `/email/${string}`; readonly alt: string }
    >
> = {
    instagram: { icon: EMAIL_USER_ASSET_PATHS.socialInstagram, alt: 'Hospeda en Instagram' },
    facebook: { icon: EMAIL_USER_ASSET_PATHS.socialFacebook, alt: 'Hospeda en Facebook' },
    x: { icon: EMAIL_USER_ASSET_PATHS.socialX, alt: 'Hospeda en X' }
};

/** Props of {@link UserFooter}. */
export interface UserFooterProps {
    /** Whether the reader has an account: shows the preferences and account links. */
    readonly showAccountLinks: boolean;
    /** Help article ids the mail declares; absent: the default set. */
    readonly helpArticleIds?: readonly string[];
    /** The recipient's verticals, for the D16 account link. */
    readonly recipientVerticals?: readonly string[];
}

/**
 * Renders the user footer.
 *
 * @param props - Whether to show account links, the declared help ids and the
 *   recipient's verticals.
 * @returns The footer rows.
 */
export function UserFooter({
    showAccountLinks,
    helpArticleIds,
    recipientVerticals
}: UserFooterProps): ReactElement {
    const { links } = resolveEmailHelpLinks({ ids: helpArticleIds });
    const account = resolveEmailAccountLinkTarget({ verticals: recipientVerticals });
    const socialProfiles = EMAIL_SOCIAL_PLATFORMS.map((platform) => ({
        platform,
        url: BRAND_SOCIAL_PROFILES.find((profile) => profile.platform === platform)?.url ?? '',
        ...SOCIAL_DECOR[platform]
    }));

    return (
        <>
            <Row data-skip-in-text="true">
                <Column
                    className={EMAIL_USER_CLASSES.surface}
                    style={waveCellStyle}
                >
                    <img
                        src={resolveEmailAssetUrl({ path: EMAIL_USER_ASSET_PATHS.footerWave })}
                        width={600}
                        alt=""
                        style={fluidImageStyle}
                    />
                </Column>
            </Row>
            <Row>
                <Column
                    className={EMAIL_USER_CLASSES.footer}
                    style={footerCellStyle}
                    data-layout-footer="user"
                >
                    <table
                        role="presentation"
                        width="100%"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                    >
                        <tbody>
                            <tr>
                                <td
                                    className={EMAIL_USER_CLASSES.padded}
                                    style={{ ...sectionCellStyle, paddingTop: '16px' }}
                                >
                                    <FooterHeading>¿Necesitás ayuda?</FooterHeading>
                                    <p style={linksParagraphStyle}>
                                        {/* The help center needs a login: readers without an
                                            account get the public FAQ page instead. */}
                                        <FooterLink
                                            href={
                                                showAccountLinks
                                                    ? EMAIL_HELP_CENTER_URL
                                                    : EMAIL_PUBLIC_FAQ_URL
                                            }
                                            layoutLink="help-center"
                                        >
                                            Centro de ayuda
                                        </FooterLink>
                                        <span style={dotStyle}>&nbsp;·&nbsp;</span>
                                        <FooterLink
                                            href={`${EMAIL_PUBLIC_SITE_URL}/es/contacto/`}
                                            layoutLink="contact"
                                        >
                                            Contacto
                                        </FooterLink>
                                        <span style={dotStyle}>&nbsp;·&nbsp;</span>
                                        <FooterLink
                                            href={BRAND_WHATSAPP_URL}
                                            layoutLink="whatsapp"
                                        >
                                            WhatsApp
                                        </FooterLink>
                                    </p>
                                </td>
                            </tr>
                            {/* Help articles live behind the login wall: hidden for readers
                                without an account (HOS-2565 §8.3). */}
                            {showAccountLinks ? (
                                <tr>
                                    <td
                                        className={EMAIL_USER_CLASSES.padded}
                                        style={{ ...sectionCellStyle, paddingTop: '26px' }}
                                        data-layout-faq="true"
                                    >
                                        <FooterHeading>Preguntas frecuentes</FooterHeading>
                                        <p style={faqParagraphStyle}>
                                            {links.map((link, index) => (
                                                <span key={link.id}>
                                                    {index > 0 ? <br /> : null}
                                                    <FooterLink
                                                        href={link.href}
                                                        layoutLink="faq"
                                                    >
                                                        {link.title}
                                                    </FooterLink>
                                                </span>
                                            ))}
                                        </p>
                                    </td>
                                </tr>
                            ) : null}
                            <tr>
                                <td
                                    className={EMAIL_USER_CLASSES.padded}
                                    style={{ ...sectionCellStyle, paddingTop: '30px' }}
                                >
                                    <FooterHeading>Nuestros canales</FooterHeading>
                                    <ChannelCards />
                                </td>
                            </tr>
                            <tr>
                                <td
                                    className={EMAIL_USER_CLASSES.padded}
                                    style={{ ...sectionCellStyle, paddingTop: '26px' }}
                                >
                                    <TrustStrip />
                                </td>
                            </tr>
                            <tr>
                                <td
                                    align="center"
                                    style={logoCellStyle}
                                    data-skip-in-text="true"
                                >
                                    <table
                                        role="img"
                                        aria-label="Hospeda"
                                        align="center"
                                        cellPadding={0}
                                        cellSpacing={0}
                                        border={0}
                                    >
                                        <tbody>
                                            <tr>
                                                <td style={footerIsotipoCellStyle}>
                                                    <img
                                                        src={resolveEmailIsotipoUrl()}
                                                        width={30}
                                                        height={32}
                                                        alt=""
                                                        style={blockImageStyle}
                                                    />
                                                </td>
                                                <td
                                                    className={EMAIL_USER_CLASSES.wordmark}
                                                    style={footerWordmarkStyle}
                                                >
                                                    hospeda
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table
                                        role="presentation"
                                        align="center"
                                        cellPadding={0}
                                        cellSpacing={0}
                                        border={0}
                                        data-layout-social="true"
                                    >
                                        <tbody>
                                            <tr>
                                                {socialProfiles.map((profile) => (
                                                    <td
                                                        key={profile.platform}
                                                        width={44}
                                                        style={socialCellStyle}
                                                    >
                                                        <a
                                                            href={profile.url}
                                                            data-layout-link={`social-${profile.platform}`}
                                                        >
                                                            <img
                                                                src={resolveEmailAssetUrl({
                                                                    path: profile.icon
                                                                })}
                                                                width={32}
                                                                height={32}
                                                                alt={profile.alt}
                                                                style={blockImageStyle}
                                                            />
                                                        </a>
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td
                                    align="center"
                                    className={`${EMAIL_USER_CLASSES.padded} ${EMAIL_USER_CLASSES.muted}`}
                                    style={smallPrintStyle}
                                >
                                    {showAccountLinks ? (
                                        <>
                                            Recibís este correo porque tenés una cuenta en Hospeda.
                                            <br />
                                            <a
                                                href={EMAIL_PREFERENCES_URL}
                                                className={EMAIL_USER_CLASSES.footerLink}
                                                style={smallLinkStyle}
                                                data-layout-link="preferences"
                                            >
                                                {EMAIL_USER_PREFERENCES_LABEL}
                                            </a>
                                            &nbsp;·&nbsp;
                                            <a
                                                href={account.href}
                                                className={EMAIL_USER_CLASSES.footerLink}
                                                style={smallLinkStyle}
                                                data-layout-link="account"
                                                data-account-link={account.kind}
                                            >
                                                {account.label}
                                            </a>
                                            <br />
                                        </>
                                    ) : null}
                                    © {new Date().getFullYear()} Hospeda
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </Column>
            </Row>
        </>
    );
}

const waveCellStyle = {
    backgroundColor: emailPalette.surface,
    fontSize: '0',
    lineHeight: '0'
};

const fluidImageStyle = {
    border: '0',
    display: 'block',
    height: 'auto',
    width: '100%'
};

const blockImageStyle = {
    border: '0',
    display: 'block'
};

const footerCellStyle = {
    backgroundColor: emailPalette.userFooterBackground,
    fontFamily: USER_FONT_STACK
};

const sectionCellStyle = {
    padding: '0 40px'
};

const linksParagraphStyle = {
    color: emailPalette.text,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0'
};

const faqParagraphStyle = {
    color: emailPalette.text,
    fontSize: '15px',
    lineHeight: '28px',
    margin: '0'
};

const dotStyle = {
    color: emailPalette.mutedText
};

const logoCellStyle = {
    padding: '28px 24px 0 24px',
    textAlign: 'center' as const
};

const footerIsotipoCellStyle = {
    paddingRight: '8px',
    verticalAlign: 'middle' as const
};

const footerWordmarkStyle = {
    color: emailPalette.brandStrong,
    fontSize: '26px',
    fontWeight: '700',
    lineHeight: '32px',
    verticalAlign: 'middle' as const
};

const socialCellStyle = {
    padding: '16px 6px 0 6px'
};

const smallPrintStyle = {
    color: emailPalette.userFooterMutedText,
    fontSize: '12px',
    lineHeight: '20px',
    padding: '24px 40px 32px 40px',
    textAlign: 'center' as const
};

const smallLinkStyle = {
    color: emailPalette.brandStrong,
    textDecoration: 'underline'
};
