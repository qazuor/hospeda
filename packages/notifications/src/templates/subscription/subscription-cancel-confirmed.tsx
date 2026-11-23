import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for SubscriptionCancelConfirmed email template (SPEC-147).
 *
 * Sent when a user initiates a soft-cancel (end-of-period cancellation).
 * The subscription remains active until `accessUntil`, which is the key
 * difference from {@link SubscriptionCancelled} (hard-cancel / webhook).
 */
export interface SubscriptionCancelConfirmedProps {
    readonly recipientName: string;
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end.
     * The user keeps full access until this date despite the cancellation.
     */
    readonly accessUntil: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Soft-cancel confirmation email template (SPEC-147).
 *
 * Sent immediately when a user successfully cancels their subscription
 * at the end of the current billing period. Unlike the hard-cancel webhook
 * notification, this email reassures the user that their access is preserved
 * until the `accessUntil` date.
 *
 * @param props - Soft-cancel confirmation data
 */
export function SubscriptionCancelConfirmed({
    recipientName,
    planName,
    accessUntil,
    baseUrl
}: SubscriptionCancelConfirmedProps) {
    const formattedAccessUntil = formatDate({ dateString: accessUntil });

    return (
        <EmailLayout
            previewText={`Confirmamos la baja de tu plan ${planName}: seguís con acceso hasta el ${formattedAccessUntil}`}
        >
            <Heading>Confirmamos tu baja</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Confirmamos la baja de tu suscripción al plan <strong>{planName}</strong>. La baja
                se hace efectiva al final del período de facturación actual.
            </Text>

            <Text style={styles.accessBanner}>
                Seguís con acceso completo hasta el <strong>{formattedAccessUntil}</strong>.
            </Text>

            <Callout tone="info">
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Acceso hasta"
                    value={formattedAccessUntil}
                />
                <InfoRow
                    label="Estado"
                    value="Baja al final del período"
                />
            </Callout>

            <Text style={styles.paragraph}>
                Después del {formattedAccessUntil}, tu cuenta vuelve al plan gratuito y no se te van
                a hacer más cobros.
            </Text>

            <Text style={styles.paragraph}>
                ¿Cambiaste de opinión? Podés reactivar tu suscripción en cualquier momento antes de
                que termine el período.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Reactivar suscripción</Button>
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
    accessBanner: {
        color: '#0f766e',
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '600',
        margin: '0 0 16px'
    }
};
