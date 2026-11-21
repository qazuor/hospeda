import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text
} from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactNode } from 'react';

/**
 * Public site origin used for every absolute URL the layout renders.
 *
 * Hard-coded on purpose (HOS-2519 §5.1): templates do not pass `siteUrl` to the
 * layout, and the emails always point at production.
 */
export const EMAIL_PUBLIC_SITE_URL = 'https://hospeda.com.ar';

/**
 * Hosted PNG logo shown in the header (HOS-2519 OQ-1).
 *
 * Served from `apps/web/public/email/hospeda-logo@2x.png`. It only resolves once
 * that file reaches production; until then clients show the styled `alt` text.
 */
export const EMAIL_LOGO_URL = `${EMAIL_PUBLIC_SITE_URL}/email/hospeda-logo@2x.png`;

/** Rendered logo width in CSS pixels (the asset is 2x: 280px wide). */
export const EMAIL_LOGO_WIDTH = 140;

/**
 * Rendered logo height in CSS pixels.
 *
 * ASSUMPTION until the owner supplies the PNG: a horizontal lockup with a 7:2
 * aspect ratio (a 280x80 @2x asset). When the real file arrives, set this to
 * `round(140 * assetHeight / assetWidth)`.
 */
export const EMAIL_LOGO_HEIGHT = 40;

/** Absolute URL of the logged-in notification preferences page (HOS-2519 OQ-2). */
export const EMAIL_PREFERENCES_URL = `${EMAIL_PUBLIC_SITE_URL}/es/mi-cuenta/preferencias/`;

/** Which extra link the footer renders. */
export type EmailFooterLink = 'preferences' | 'none';

/**
 * Props for {@link EmailLayout}.
 */
export interface EmailLayoutProps {
    /** Preheader shown by the inbox next to the subject. Omitted: no `<Preview>`. */
    readonly previewText?: string;
    /** Email body content. */
    readonly children: ReactNode;
    /**
     * Extra footer link. `'preferences'` links to the notification preferences
     * page (logged-in users only); `'none'` renders no extra link.
     * @default 'none'
     */
    readonly footerLink?: EmailFooterLink;
}

/**
 * The single layout every Hospeda email renders inside (HOS-2519 D1/D2).
 *
 * Email-client-safe by construction: inline styles only, table layout from
 * React Email, hex colors from `emailPalette`, fluid widths up to 600px, no
 * flexbox, grid, CSS variables, web fonts or SVG. The decorative header is
 * marked `data-skip-in-text` so the text/plain part starts at the body copy.
 *
 * @param props - Layout configuration.
 * @returns The full email document.
 *
 * @example
 * ```tsx
 * import { EmailLayout } from '@repo/email';
 *
 * export function MyEmail() {
 *     return (
 *         <EmailLayout previewText="Tu reserva fue confirmada" footerLink="preferences">
 *             <Text>Contenido</Text>
 *         </EmailLayout>
 *     );
 * }
 * ```
 */
export function EmailLayout({ previewText, children, footerLink = 'none' }: EmailLayoutProps) {
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
            </Head>
            {previewText ? <Preview>{previewText}</Preview> : null}
            <Body style={styles.body}>
                <Container
                    width="100%"
                    style={styles.container}
                >
                    <Section
                        style={styles.header}
                        data-skip-in-text="true"
                    >
                        <Img
                            src={EMAIL_LOGO_URL}
                            width={EMAIL_LOGO_WIDTH}
                            height={EMAIL_LOGO_HEIGHT}
                            alt="Hospeda"
                            style={styles.logo}
                        />
                        <Text style={styles.tagline}>Turismo en el Litoral</Text>
                    </Section>

                    <Section style={styles.content}>{children}</Section>

                    <Section style={styles.footer}>
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
                            >
                                hospeda.com.ar
                            </Link>
                        </Text>
                        {footerLink === 'preferences' ? (
                            <Text style={styles.footerSubtext}>
                                <Link
                                    href={EMAIL_PREFERENCES_URL}
                                    style={styles.footerLink}
                                >
                                    Administrar preferencias de notificaciones
                                </Link>
                            </Text>
                        ) : null}
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

const FONT_STACK =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const styles = {
    body: {
        backgroundColor: emailPalette.pageBackground,
        fontFamily: FONT_STACK,
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
    /** Also styles the alt text, so a blocked image still reads as a brand mark (R-7). */
    logo: {
        display: 'block',
        border: '0',
        margin: '0 auto',
        maxWidth: '100%',
        height: 'auto',
        color: emailPalette.brandStrong,
        fontFamily: FONT_STACK,
        fontSize: '28px',
        fontWeight: 'bold',
        lineHeight: `${EMAIL_LOGO_HEIGHT}px`,
        textAlign: 'center' as const
    },
    tagline: {
        color: emailPalette.mutedText,
        fontSize: '14px',
        lineHeight: '20px',
        letterSpacing: '0.5px',
        margin: '8px 0 0'
    },
    content: {
        padding: '32px 24px'
    },
    footer: {
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
