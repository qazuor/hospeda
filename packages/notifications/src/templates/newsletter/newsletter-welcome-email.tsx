import { Link, Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/**
 * Props for NewsletterWelcomeEmail template
 */
export interface NewsletterWelcomeEmailProps {
    /** Optional first name for personalized greeting */
    firstName?: string;
    /** Base URL for account CTA (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    /** Optional WhatsApp channel invite URL — renders the CTA when present */
    waChannelUrl?: string;
    /**
     * Public one-click unsubscribe URL. Its presence marks the GUEST variant (subscriber
     * without an account): the account-only copy and the "Mi cuenta" button are replaced
     * by this link. Absent means the subscriber has an account.
     */
    unsubscribeUrl?: string;
    /** When true, prefixes subject and shows a test banner */
    isTest?: boolean;
}

/**
 * Newsletter welcome email
 * Sent immediately after a subscriber confirms their email (double opt-in complete).
 * Optionally invites them to follow the WhatsApp broadcast channel.
 *
 * @param props - Welcome payload
 */
export function NewsletterWelcomeEmail({
    firstName,
    baseUrl,
    waChannelUrl,
    unsubscribeUrl,
    isTest = false
}: NewsletterWelcomeEmailProps) {
    const previewText = isTest
        ? '[PRUEBA] ¡Bienvenido al newsletter de Hospeda!'
        : '¡Bienvenido al newsletter de Hospeda!';
    const greetingName = firstName?.trim() ? firstName.trim() : null;

    return (
        <EmailLayout
            footerLink="none"
            previewText={previewText}
        >
            {isTest && (
                <Callout tone="warning">
                    <Text style={styles.testBannerText}>
                        [PRUEBA] Este es un envío de prueba. La suscripción no fue activada.
                    </Text>
                </Callout>
            )}

            <Heading>¡Listo, ya estás suscripto!</Heading>

            <Text style={styles.greeting}>{greetingName ? `Hola ${greetingName},` : '¡Hola!'}</Text>

            <Text style={styles.paragraph}>
                Gracias por confirmar tu suscripción al newsletter de Hospeda. A partir de ahora vas
                a recibir nuestras novedades sobre alojamientos, eventos y experiencias en
                Concepción del Uruguay y el Litoral argentino.
            </Text>

            {unsubscribeUrl ? null : (
                <>
                    <Text style={styles.paragraph}>
                        Podés gestionar tus preferencias de comunicación en cualquier momento desde
                        tu cuenta.
                    </Text>

                    <Button href={`${baseUrl}/es/mi-cuenta/newsletter/`}>
                        Ver mis preferencias
                    </Button>
                </>
            )}

            {waChannelUrl && (
                <>
                    <Text style={styles.paragraph}>
                        ¿Querés enterarte todavía más rápido? Sumate también a nuestro canal de
                        WhatsApp para recibir las novedades en tu celular.
                    </Text>

                    <Button
                        href={waChannelUrl}
                        variant="secondary"
                    >
                        Unirme al canal de WhatsApp
                    </Button>
                </>
            )}

            {unsubscribeUrl ? (
                <Text style={styles.footerNote}>
                    Si en algún momento no querés recibirlo más, podés darte de baja desde este
                    link.{' '}
                    <Link
                        href={unsubscribeUrl}
                        style={styles.unsubscribeLink}
                    >
                        Darme de baja
                    </Link>
                </Text>
            ) : (
                <Text style={styles.footerNote}>
                    Si en algún momento no querés recibir más correos, vas a poder darte de baja
                    desde el pie de cada newsletter.
                </Text>
            )}
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
    unsubscribeLink: {
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
