import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for SubscriptionCancelled email template
 */
export interface SubscriptionCancelledProps {
    readonly recipientName: string;
    readonly planName: string;
    /** ISO date string for when access ends (optional if immediate) */
    readonly currentPeriodEnd?: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Subscription cancellation email template.
 * Sent when a subscription is cancelled (from MercadoPago webhook).
 *
 * @param props - Subscription cancellation data
 */
export function SubscriptionCancelled({
    recipientName,
    planName,
    currentPeriodEnd,
    baseUrl
}: SubscriptionCancelledProps) {
    const formattedEndDate = currentPeriodEnd
        ? formatDate({ dateString: currentPeriodEnd })
        : undefined;

    return (
        <EmailLayout
            previewText={`Tu suscripcion al plan ${planName} ha sido cancelada`}
            showUnsubscribe={false}
        >
            <Heading>Tu suscripcion ha sido cancelada</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripcion al plan <strong>{planName}</strong> ha sido cancelada.
            </Text>

            {formattedEndDate && (
                <Text style={styles.paragraph}>
                    Tu acceso continuara activo hasta el <strong>{formattedEndDate}</strong>.
                </Text>
            )}

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                {formattedEndDate && (
                    <InfoRow
                        label="Acceso hasta"
                        value={formattedEndDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Si no realizaste esta cancelacion, contactanos para resolverlo.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/precios/propietarios`}>Reactivar suscripcion</Button>
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
    infoBox: {
        backgroundColor: '#f8fafc',
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
