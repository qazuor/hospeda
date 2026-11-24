/**
 * The STAFF variant of `EmailLayout` (HOS-2565 D10, AC-4.1): the pre-PR-4 layout,
 * moved here verbatim. A snapshot test pins its bytes, so a user-layout change can
 * never reach the 13 staff mails.
 *
 * @module templates/staff-layout
 */

import {
    Body,
    Column,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Text
} from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement, ReactNode } from 'react';
import { EMAIL_BUTTON_MEDIA_RULE } from '../components/button.js';
import {
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_SITE_URL,
    resolveEmailIsotipoUrl
} from '../email-assets.js';

/** Rendered isotipo width in CSS pixels (the asset is 2x: 89x96). */
export const EMAIL_ISOTIPO_WIDTH = 44;

/**
 * Rendered isotipo height in CSS pixels. Keep it at the asset's aspect ratio
 * (89:96 ~ 44:48), since Outlook desktop honours the `height` attribute.
 */
export const EMAIL_ISOTIPO_HEIGHT = 48;

/** Props of {@link StaffEmailLayout}. */
export interface StaffEmailLayoutProps {
    readonly previewText?: string;
    readonly children: ReactNode;
    /** @default 'none' */
    readonly footerLink?: 'preferences' | 'none';
}

/**
 * Renders the staff layout: white header with the isotipo, wordmark and tagline, a
 * 4px brand bar, and the two-line footer.
 *
 * @param props - Layout configuration.
 * @returns The full email document.
 */
export function StaffEmailLayout({
    previewText,
    children,
    footerLink = 'none'
}: StaffEmailLayoutProps): ReactElement {
    return (
        <Html
            lang="es"
            dir="ltr"
        >
            <Head>
                <meta
                    name="color-scheme"
                    content="light"
                />
                <meta
                    name="supported-color-schemes"
                    content="light"
                />
                {/* The ONLY <style> rule (HOS-2565 D4, AC-2.6): full-width buttons on narrow screens. */}
                <style>{EMAIL_BUTTON_MEDIA_RULE}</style>
            </Head>
            {previewText ? <Preview>{previewText}</Preview> : null}
            <Body
                style={styles.body}
                data-layout-variant="staff"
            >
                {/* Outlook desktop (Word) ignores max-width: a fixed 600px ghost table caps the card there. */}
                <div
                    style={styles.msoHost}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: module constant (an MSO conditional comment), never user input; React has no other way to emit a comment.
                    dangerouslySetInnerHTML={{ __html: MSO_GHOST_TABLE_OPEN }}
                />
                <Container
                    width="100%"
                    style={styles.container}
                >
                    <Row data-skip-in-text="true">
                        <Column style={styles.header}>
                            {/* One accessible name for the whole mark; no flex/grid, so a nested table lines the two up. */}
                            <table
                                role="img"
                                aria-label="Hospeda"
                                align="center"
                                cellPadding={0}
                                cellSpacing={0}
                                border={0}
                                style={styles.brandTable}
                            >
                                <tbody>
                                    <tr>
                                        <td style={styles.isotipoCell}>
                                            <Img
                                                src={resolveEmailIsotipoUrl()}
                                                width={EMAIL_ISOTIPO_WIDTH}
                                                height={EMAIL_ISOTIPO_HEIGHT}
                                                alt=""
                                                style={styles.isotipo}
                                            />
                                        </td>
                                        <td style={styles.wordmarkCell}>
                                            <span style={styles.wordmark}>hospeda</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <Text style={styles.tagline}>Turismo en el Litoral</Text>
                        </Column>
                    </Row>

                    <Row>
                        <Column style={styles.content}>{children}</Column>
                    </Row>

                    <Row>
                        <Column style={styles.footer}>
                            <Hr style={styles.divider} />
                            <Text style={styles.footerText}>Hospeda - Turismo en el Litoral</Text>
                            <Text style={styles.footerSubtext}>
                                Plataforma de alojamientos turísticos en Concepción del Uruguay y la
                                región del Litoral argentino
                            </Text>
                            <Text style={styles.footerSubtext}>
                                <Link
                                    href={EMAIL_PUBLIC_SITE_URL}
                                    style={styles.footerLink}
                                    data-layout-link="home"
                                >
                                    hospeda.com.ar
                                </Link>
                            </Text>
                            {footerLink === 'preferences' ? (
                                <Text style={styles.footerSubtext}>
                                    <Link
                                        href={EMAIL_PREFERENCES_URL}
                                        style={styles.footerLink}
                                        data-layout-link="preferences"
                                    >
                                        Administrar preferencias de notificaciones
                                    </Link>
                                </Text>
                            ) : null}
                        </Column>
                    </Row>
                </Container>
                <div
                    style={styles.msoHost}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: module constant (an MSO conditional comment), never user input; React has no other way to emit a comment.
                    dangerouslySetInnerHTML={{ __html: MSO_GHOST_TABLE_CLOSE }}
                />
            </Body>
        </Html>
    );
}

/** Card width Outlook desktop gets through the ghost table (every other client is fluid). */
const EMAIL_CARD_WIDTH = 600;

/**
 * MSO-only "ghost table" around the card. Word ignores `max-width`, so without
 * it the card stretches to the full window in Outlook desktop. Every other
 * client sees only an HTML comment. React cannot emit a bare comment, so each
 * half lives in an empty wrapper `<div>` (see {@link EmailLayout}).
 */
const MSO_GHOST_TABLE_OPEN = `<!--[if mso]><table role="presentation" width="${EMAIL_CARD_WIDTH}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`;
const MSO_GHOST_TABLE_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->';

const FONT_STACK =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const styles = {
    body: {
        backgroundColor: emailPalette.pageBackground,
        fontFamily: FONT_STACK,
        margin: '0',
        padding: '0'
    },
    msoHost: {
        margin: '0',
        padding: '0'
    },
    container: {
        backgroundColor: emailPalette.surface,
        margin: '0 auto',
        padding: '0',
        maxWidth: '600px'
    },
    header: {
        backgroundColor: emailPalette.surface,
        borderBottom: `4px solid ${emailPalette.brand}`,
        padding: '24px 24px 16px',
        textAlign: 'center' as const
    },
    brandTable: {
        margin: '0 auto',
        borderCollapse: 'collapse' as const
    },
    isotipoCell: {
        padding: '0 10px 0 0',
        verticalAlign: 'middle' as const
    },
    isotipo: {
        display: 'block',
        border: '0',
        width: `${EMAIL_ISOTIPO_WIDTH}px`,
        height: `${EMAIL_ISOTIPO_HEIGHT}px`
    },
    wordmarkCell: {
        padding: '0',
        verticalAlign: 'middle' as const
    },
    /** Live text next to the isotipo: recolorable by dark-mode clients that invert text. */
    wordmark: {
        color: emailPalette.brandStrong,
        fontFamily: FONT_STACK,
        fontSize: '30px',
        fontWeight: '800',
        letterSpacing: '-0.5px',
        lineHeight: `${EMAIL_ISOTIPO_HEIGHT}px`
    },
    tagline: {
        color: emailPalette.mutedText,
        fontSize: '14px',
        lineHeight: '20px',
        letterSpacing: '0.5px',
        margin: '8px 0 0'
    },
    content: {
        backgroundColor: emailPalette.surface,
        padding: '32px 24px'
    },
    footer: {
        backgroundColor: emailPalette.surface,
        padding: '0 24px 24px',
        textAlign: 'center' as const
    },
    divider: {
        borderColor: emailPalette.border,
        margin: '0 0 24px'
    },
    footerText: {
        color: emailPalette.text,
        fontSize: '14px',
        fontWeight: '600',
        lineHeight: '20px',
        margin: '0 0 8px'
    },
    footerSubtext: {
        color: emailPalette.mutedText,
        fontSize: '12px',
        lineHeight: '18px',
        margin: '4px 0'
    },
    footerLink: {
        color: emailPalette.link,
        textDecoration: 'underline'
    }
};
