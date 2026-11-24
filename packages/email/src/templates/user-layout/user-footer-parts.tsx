/**
 * Building blocks of the USER email footer (HOS-2565 PR-4): section headings, the
 * "Nuestros canales" cards and the trust strip. Split from `user-footer.tsx` to keep
 * each file small.
 *
 * @module templates/user-layout/user-footer-parts
 */

import { BRAND_CONTACT_EMAIL, BRAND_PHONE_DISPLAY, BRAND_WHATSAPP_URL } from '@repo/config';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement, ReactNode } from 'react';
import { EMAIL_PUBLIC_SITE_URL, resolveEmailAssetUrl } from '../../email-assets.js';
import { EMAIL_USER_ASSET_PATHS } from './user-assets.js';
import { EMAIL_USER_CLASSES } from './user-styles.js';

/** A footer section title ("¿Necesitás ayuda?", "Preguntas frecuentes", ...). */
export function FooterHeading({ children }: { readonly children: ReactNode }): ReactElement {
    return <h3 style={footerHeadingStyle}>{children}</h3>;
}

/** An underlined bold footer link. */
export function FooterLink({
    href,
    children,
    layoutLink
}: {
    readonly href: string;
    readonly children: ReactNode;
    /** `data-layout-link` value, which also names the UTM slot. */
    readonly layoutLink: string;
}): ReactElement {
    return (
        <a
            href={href}
            style={footerLinkStyle}
            data-layout-link={layoutLink}
        >
            {children}
        </a>
    );
}

/** One "Nuestros canales" card. */
interface ChannelCardProps {
    readonly icon: `/email/${string}`;
    readonly title: string;
    readonly children: ReactNode;
}

/** A white channel card with a teal/green icon, a bold title and a short text. */
function ChannelCard({ icon, title, children }: ChannelCardProps): ReactElement {
    return (
        <td
            className={`${EMAIL_USER_CLASSES.stack} ${EMAIL_USER_CLASSES.channel}`}
            width="31%"
            style={channelCellStyle}
        >
            <img
                src={resolveEmailAssetUrl({ path: icon })}
                width={44}
                height={44}
                alt=""
                style={blockImageStyle}
                data-skip-in-text="true"
            />
            <p style={channelTitleStyle}>{title}</p>
            <p style={channelTextStyle}>{children}</p>
        </td>
    );
}

/** Gap cell between two channel cards; collapses to a 12px row on mobile. */
function ChannelSpacer(): ReactElement {
    return (
        <td
            className={`${EMAIL_USER_CLASSES.stack} ${EMAIL_USER_CLASSES.spacer}`}
            width={12}
            style={spacerStyle}
        >
            &nbsp;
        </td>
    );
}

/** The three "Nuestros canales" cards: security, web and contact. */
export function ChannelCards(): ReactElement {
    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
        >
            <tbody>
                <tr>
                    <ChannelCard
                        icon={EMAIL_USER_ASSET_PATHS.channelSecurity}
                        title="Seguridad"
                    >
                        Nunca te vamos a pedir tu contraseña ni los datos de tu tarjeta por correo.
                    </ChannelCard>
                    <ChannelSpacer />
                    <ChannelCard
                        icon={EMAIL_USER_ASSET_PATHS.channelWeb}
                        title="Web"
                    >
                        <a
                            href={EMAIL_PUBLIC_SITE_URL}
                            className={EMAIL_USER_CLASSES.channelLink}
                            style={channelLinkStyle}
                            data-layout-link="channel-web"
                        >
                            hospeda.com.ar
                        </a>
                        <br />
                        Alojamientos, destinos y experiencias del Litoral
                    </ChannelCard>
                    <ChannelSpacer />
                    <ChannelCard
                        icon={EMAIL_USER_ASSET_PATHS.channelContact}
                        title="Contacto"
                    >
                        {BRAND_CONTACT_EMAIL}
                        <br />
                        {BRAND_PHONE_DISPLAY}
                        <br />
                        <a
                            href={BRAND_WHATSAPP_URL}
                            className={EMAIL_USER_CLASSES.channelLink}
                            style={channelLinkStyle}
                            data-layout-link="channel-whatsapp"
                        >
                            WhatsApp
                        </a>
                    </ChannelCard>
                </tr>
            </tbody>
        </table>
    );
}

/** One trust strip item. */
function TrustItem({
    icon,
    children
}: {
    readonly icon: `/email/${string}`;
    readonly children: ReactNode;
}): ReactElement {
    return (
        <td
            className={EMAIL_USER_CLASSES.stack}
            align="center"
            style={trustCellStyle}
        >
            <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                align="center"
            >
                <tbody>
                    <tr>
                        <td
                            style={trustIconCellStyle}
                            data-skip-in-text="true"
                        >
                            <img
                                src={resolveEmailAssetUrl({ path: icon })}
                                width={22}
                                height={22}
                                alt=""
                                style={blockImageStyle}
                            />
                        </td>
                        <td style={trustTextStyle}>{children}</td>
                    </tr>
                </tbody>
            </table>
        </td>
    );
}

/** The trust strip: local support, safe payments, no hidden fees. */
export function TrustStrip(): ReactElement {
    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            className={EMAIL_USER_CLASSES.rule}
            style={trustTableStyle}
        >
            <tbody>
                <tr>
                    <TrustItem icon={EMAIL_USER_ASSET_PATHS.trustSupport}>
                        Soporte local en español
                    </TrustItem>
                    <TrustItem icon={EMAIL_USER_ASSET_PATHS.trustPayments}>Pagos seguros</TrustItem>
                    <TrustItem icon={EMAIL_USER_ASSET_PATHS.trustFees}>
                        Sin comisiones ocultas
                    </TrustItem>
                </tr>
            </tbody>
        </table>
    );
}

const footerHeadingStyle = {
    color: emailPalette.text,
    fontSize: '17px',
    fontWeight: '700',
    lineHeight: '24px',
    margin: '0 0 6px 0'
};

const footerLinkStyle = {
    color: emailPalette.text,
    fontWeight: '700',
    textDecoration: 'underline'
};

const blockImageStyle = {
    border: '0',
    display: 'block'
};

const channelCellStyle = {
    backgroundColor: emailPalette.surface,
    color: emailPalette.userFooterMutedText,
    padding: '16px 14px',
    verticalAlign: 'top' as const,
    width: '31%'
};

const channelTitleStyle = {
    color: emailPalette.text,
    fontSize: '15px',
    fontWeight: '700',
    lineHeight: '20px',
    margin: '10px 0 4px 0'
};

const channelTextStyle = {
    color: emailPalette.userFooterMutedText,
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0'
};

const channelLinkStyle = {
    color: emailPalette.buttonPrimary,
    fontWeight: '700'
};

const spacerStyle = {
    fontSize: '0',
    lineHeight: '0',
    width: '12px'
};

const trustTableStyle = {
    borderBottom: `1px solid ${emailPalette.userFooterRule}`,
    borderTop: `1px solid ${emailPalette.userFooterRule}`
};

const trustCellStyle = {
    padding: '14px 4px'
};

const trustIconCellStyle = {
    paddingRight: '8px'
};

const trustTextStyle = {
    color: emailPalette.text,
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: '18px'
};
