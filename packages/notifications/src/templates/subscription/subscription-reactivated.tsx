import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for SubscriptionReactivated email template
 */
export interface SubscriptionReactivatedProps {
    readonly recipientName: string;
    readonly planName: string;
    /** ISO date string for the next billing cycle (optional) */
    readonly nextBillingDate?: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Subscription reactivated email template.
 * Sent when a subscription is reactivated after being paused or cancelled.
 *
 * @param props - Subscription reactivation data
 */
export function SubscriptionReactivated({
    recipientName,
    planName,
    nextBillingDate,
    baseUrl
}: SubscriptionReactivatedProps) {
    const formattedBillingDate = nextBillingDate
        ? formatDate({ dateString: nextBillingDate })
        : undefined;

    return (
        <EmailLayout
            previewText={`Tu suscripcion al plan ${planName} esta activa nuevamente`}
            showUnsubscribe={false}
        >
            <Heading>Tu suscripcion ha sido reactivada</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripcion al plan <strong>{planName}</strong> esta activa nuevamente.
            </Text>

            <Section style={styles.successBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Estado"
                    value="Activa"
                />
                {formattedBillingDate && (
                    <InfoRow
                        label="Proxima facturacion"
                        value={formattedBillingDate}
                    />
                )}
            </Section>

            {formattedBillingDate && (
                <Text style={styles.paragraph}>
                    Tu proxima facturacion es el <strong>{formattedBillingDate}</strong>.
                </Text>
            )}

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta`}>Ir al panel</Button>
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
    successBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
        borderLeft: '4px solid #0f766e',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    }
};
