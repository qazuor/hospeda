import { Body, Container, Head, Hr, Html, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

/**
 * Props for the base email layout.
 */
export interface BaseLayoutProps {
    /**
     * Email body content.
     */
    readonly children: ReactNode;

    /**
     * Whether to show the unsubscribe text in footer.
     * @default true
     */
    readonly showUnsubscribe?: boolean;
}

/**
 * Base email layout component with Hospeda branding.
 *
 * Provides consistent header, footer, and styling across all email templates.
 * Uses a centered container with max-width of 600px.
 *
 * @param props - Layout configuration
 * @returns Rendered email layout with Hospeda branding
 *
 * @example
 * ```tsx
 * import { BaseLayout } from '@repo/email';
 *
 * export function MyEmailTemplate() {
 *   return (
 *     <BaseLayout>
 *       <Text>Your email content here</Text>
 *     </BaseLayout>
 *   );
 * }
 * ```
 */
export function BaseLayout({ children, showUnsubscribe = true }: BaseLayoutProps) {
    return (
        <Html>
            <Head />
            <Body style={main}>
                <Container style={container}>
                    {/* Header */}
                    <Section style={header}>
                        <Text style={logo}>Hospeda</Text>
                    </Section>

                    {/* Content */}
                    <Section style={content}>{children}</Section>

                    {/* Footer */}
                    <Hr style={divider} />
                    <Section style={footer}>
                        <Text style={footerText}>
                            Hospeda - Alojamientos turísticos en Concepción del Uruguay y el Litoral
                        </Text>
                        {showUnsubscribe && (
                            <Text style={footerText}>
                                Si no deseas recibir estos correos, puedes{' '}
                                <a
                                    href="https://hospeda.com.ar/unsubscribe"
                                    style={link}
                                >
                                    darte de baja aquí
                                </a>
                                .
                            </Text>
                        )}
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

// Styles
const main = {
    backgroundColor: '#f6f9fc',
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    maxWidth: '600px'
};

const header = {
    padding: '32px 24px',
    textAlign: 'center' as const
};

const logo = {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1a202c',
    margin: '0'
};

const content = {
    padding: '0 24px'
};

const divider = {
    borderColor: '#e2e8f0',
    margin: '32px 0'
};

const footer = {
    padding: '0 24px'
};

const footerText = {
    color: '#718096',
    fontSize: '12px',
    lineHeight: '16px',
    margin: '4px 0'
};

const link = {
    color: '#3182ce',
    textDecoration: 'underline'
};
