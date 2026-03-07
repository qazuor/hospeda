import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for SubscriptionPaused email template
 */
export interface SubscriptionPausedProps {
    readonly recipientName: string;
    readonly planName: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Subscription paused email template.
 * Sent when a subscription is suspended (usually due to payment issues).
 *
 * @param props - Subscription paused data
 */
export function SubscriptionPaused({ recipientName, planName, baseUrl }: SubscriptionPausedProps) {
    return (
        <EmailLayout
            previewText={`Tu suscripcion al plan ${planName} ha sido pausada`}
            showUnsubscribe={false}
        >
            <Heading>Tu suscripcion ha sido pausada</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripcion al plan <strong>{planName}</strong> ha sido pausada.
            </Text>

            <Text style={styles.paragraph}>
                Esto puede deberse a un problema con tu metodo de pago.
            </Text>

            <Section style={styles.warningBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Estado"
                    value="Pausada"
                />
            </Section>

            <Text style={styles.paragraph}>
                Actualiza tu metodo de pago para reactivar tu suscripcion.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>
                    Actualizar metodo de pago
                </Button>
            </Section>
        </EmailLayout>
    );
}

const styles = {
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
    warningBox: {
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    }
};
