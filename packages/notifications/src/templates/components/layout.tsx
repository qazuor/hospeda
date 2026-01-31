import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text
} from '@react-email/components';
import type React from 'react';

/**
 * Props for EmailLayout component
 */
export interface EmailLayoutProps {
    /** Preview text shown in email client (preheader) */
    previewText: string;
    /** Main email content */
    children: React.ReactNode;
    /** Whether to show unsubscribe link in footer */
    showUnsubscribe?: boolean;
}

/**
 * Shared email layout component
 * Provides consistent branding and structure for all email templates
 */
export function EmailLayout({ previewText, children, showUnsubscribe = false }: EmailLayoutProps) {
    return (
        <Html lang="es">
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={styles.body}>
                <Container style={styles.container}>
                    {/* Header */}
                    <Section style={styles.header}>
                        <Text style={styles.logo}>Hospeda</Text>
                        <Text style={styles.tagline}>Turismo en el Litoral</Text>
                    </Section>

                    {/* Main content */}
                    <Section style={styles.content}>{children}</Section>

                    {/* Footer */}
                    <Section style={styles.footer}>
                        <Hr style={styles.divider} />
                        <Text style={styles.footerText}>Hospeda - Turismo en el Litoral</Text>
                        <Text style={styles.footerSubtext}>
                            Plataforma de alojamientos turísticos en Concepción del Uruguay y la
                            región del Litoral argentino
                        </Text>
                        {showUnsubscribe && (
                            <Text style={styles.footerSubtext}>
                                <Link
                                    href="{{unsubscribe_url}}"
                                    style={styles.unsubscribeLink}
                                >
                                    Administrar preferencias de notificaciones
                                </Link>
                            </Text>
                        )}
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

const styles = {
    body: {
        backgroundColor: '#f6f9fc',
        fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
        margin: 0,
        padding: 0
    },
    container: {
        backgroundColor: '#ffffff',
        margin: '0 auto',
        padding: '0',
        maxWidth: '600px',
        width: '100%'
    },
    header: {
        backgroundColor: '#1e293b',
        padding: '32px 24px',
        textAlign: 'center' as const
    },
    logo: {
        color: '#ffffff',
        fontSize: '32px',
        fontWeight: 'bold',
        margin: '0 0 8px',
        letterSpacing: '-0.5px'
    },
    tagline: {
        color: '#94a3b8',
        fontSize: '14px',
        margin: '0',
        letterSpacing: '0.5px'
    },
    content: {
        padding: '40px 24px'
    },
    footer: {
        padding: '24px',
        textAlign: 'center' as const
    },
    divider: {
        borderColor: '#e2e8f0',
        margin: '0 0 24px'
    },
    footerText: {
        color: '#475569',
        fontSize: '14px',
        fontWeight: '600',
        margin: '0 0 8px'
    },
    footerSubtext: {
        color: '#94a3b8',
        fontSize: '12px',
        lineHeight: '18px',
        margin: '4px 0'
    },
    unsubscribeLink: {
        color: '#64748b',
        textDecoration: 'underline'
    }
};
