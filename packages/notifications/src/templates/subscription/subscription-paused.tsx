import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';

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
 *
 * Sent for every pause origin: a host pausing their own subscription, an
 * admin pausing it, or MercadoPago reporting a dunning-driven pause. The
 * copy is deliberately origin-neutral (HOS-926) — nothing in the pause
 * webhook tells this template WHY the subscription was paused, so it must
 * never assume a payment problem. Assuming one told hosts who paused
 * themselves (or were paused by an admin) that their card had failed, which
 * was never true for them.
 *
 * @param props - Subscription paused data
 */
export function SubscriptionPaused({ recipientName, planName, baseUrl }: SubscriptionPausedProps) {
    return (
        <EmailLayout previewText={`Tu suscripcion al plan ${planName} ha sido pausada`}>
            <Heading>Tu suscripcion ha sido pausada</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripcion al plan <strong>{planName}</strong> ha sido pausada.
            </Text>

            <Callout tone="warning">
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Estado"
                    value="Pausada"
                />
            </Callout>

            <Text style={styles.paragraph}>
                Podes revisar el estado de tu suscripcion y reactivarla cuando quieras desde tu
                cuenta.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Ver mi suscripcion</Button>
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
