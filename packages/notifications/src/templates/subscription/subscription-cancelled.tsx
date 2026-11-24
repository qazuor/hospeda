import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
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
        <EmailLayout previewText={`Tu suscripción al plan ${planName} fue cancelada`}>
            <Heading>Tu suscripción fue cancelada</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripción al plan <strong>{planName}</strong> fue cancelada.
            </Text>

            {formattedEndDate && (
                <Text style={styles.paragraph}>
                    Tu acceso sigue activo hasta el <strong>{formattedEndDate}</strong>.
                </Text>
            )}

            <Callout tone="info">
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
            </Callout>

            <Text style={styles.paragraph}>Si no fuiste vos, escribinos para resolverlo.</Text>

            {/* No "reactivar": a cancelled subscription cannot come back (HOS-2580 §A2, PROH:B:1). */}
            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Ver mi suscripción</Button>
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
    }
};
