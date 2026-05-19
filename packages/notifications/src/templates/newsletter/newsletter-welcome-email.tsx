import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

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
    isTest = false
}: NewsletterWelcomeEmailProps) {
    const previewText = isTest
        ? '[PRUEBA] ¡Bienvenido al newsletter de Hospeda!'
        : '¡Bienvenido al newsletter de Hospeda!';
    const greetingName = firstName?.trim() ? firstName.trim() : null;

    return (
        <EmailLayout previewText={previewText}>
            {isTest && (
                <Section style={styles.testBanner}>
                    <Text style={styles.testBannerText}>
                        [PRUEBA] Este es un envío de prueba. La suscripción no fue activada.
                    </Text>
                </Section>
            )}

            <Heading>¡Listo, ya estás suscripto!</Heading>

            <Text style={styles.greeting}>{greetingName ? `Hola ${greetingName},` : '¡Hola!'}</Text>

            <Text style={styles.paragraph}>
                Gracias por confirmar tu suscripción al newsletter de Hospeda. A partir de ahora vas
                a recibir nuestras novedades sobre alojamientos, eventos y experiencias en
                Concepción del Uruguay y el Litoral argentino.
            </Text>

            <Text style={styles.paragraph}>
                Podés gestionar tus preferencias de comunicación en cualquier momento desde tu
                cuenta.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/newsletter`}>Ver mis preferencias</Button>
            </Section>

            {waChannelUrl && (
                <>
                    <Text style={styles.paragraph}>
                        ¿Querés enterarte todavía más rápido? Sumate también a nuestro canal de
                        WhatsApp para recibir las novedades en tu celular.
                    </Text>

                    <Section style={styles.buttonContainer}>
                        <Button
                            href={waChannelUrl}
                            variant="secondary"
                        >
                            Unirme al canal de WhatsApp
                        </Button>
                    </Section>
                </>
            )}

            <Text style={styles.footerNote}>
                Si en algún momento no querés recibir más correos, vas a poder darte de baja desde
                el pie de cada newsletter.
            </Text>
        </EmailLayout>
    );
}

const styles = {
    testBanner: {
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        padding: '12px 16px',
        margin: '0 0 24px'
    },
    testBannerText: {
        color: '#92400e',
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
    buttonContainer: {
        margin: '24px 0',
        textAlign: 'center' as const
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
