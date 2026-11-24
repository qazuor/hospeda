import { Link, Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/**
 * Props for NewsletterVerifyEmail template
 */
export interface NewsletterVerifyEmailProps {
    /** Optional first name for personalized greeting */
    firstName?: string;
    /** Verification URL with HMAC token (built by service layer) */
    verifyUrl: string;
    /** When true, prefixes subject and shows a test banner */
    isTest?: boolean;
}

/**
 * Newsletter verification email (double opt-in)
 * Sent right after a user requests to subscribe. The recipient must click
 * the CTA to confirm. Token validity is enforced by the verify endpoint.
 *
 * @param props - Verification payload
 */
export function NewsletterVerifyEmail({
    firstName,
    verifyUrl,
    isTest = false
}: NewsletterVerifyEmailProps) {
    const previewText = isTest
        ? '[PRUEBA] Confirmá tu suscripción al newsletter de Hospeda'
        : 'Confirmá tu suscripción al newsletter de Hospeda';
    const greetingName = firstName?.trim() ? firstName.trim() : 'Hola';

    return (
        <EmailLayout
            footerLink="none"
            previewText={previewText}
        >
            {isTest && (
                <Callout tone="warning">
                    <Text style={styles.testBannerText}>
                        [PRUEBA] Este es un envío de prueba. Ningún destinatario fue suscripto.
                    </Text>
                </Callout>
            )}

            <Heading>Confirmá tu suscripción</Heading>

            <Text style={styles.greeting}>
                {firstName?.trim() ? `Hola ${greetingName},` : '¡Hola!'}
            </Text>

            <Text style={styles.paragraph}>
                Recibimos una solicitud para suscribirte al newsletter de Hospeda. Para activar tu
                suscripción y empezar a recibir nuestras novedades, confirmá tu dirección de correo
                haciendo clic en el botón:
            </Text>

            <Button href={verifyUrl}>Confirmar mi suscripción</Button>

            <Text style={styles.paragraph}>
                Si el botón no funciona, copiá y pegá esta dirección en tu navegador:
            </Text>

            <Text style={styles.fallbackUrl}>
                <Link
                    href={verifyUrl}
                    style={styles.fallbackLink}
                >
                    {verifyUrl}
                </Link>
            </Text>

            <Text style={styles.footerNote}>
                Si no fuiste vos quien solicitó esta suscripción, ignorá este mensaje. No te
                suscribiremos sin tu confirmación.
            </Text>
        </EmailLayout>
    );
}

const styles = {
    testBannerText: {
        fontSize: '14px',
        fontWeight: '600',
        margin: 0,
        textAlign: 'center' as const
    },
    greeting: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    fallbackUrl: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 24px',
        wordBreak: 'break-all' as const
    },
    fallbackLink: {
        color: '#3b82f6',
        textDecoration: 'underline'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
