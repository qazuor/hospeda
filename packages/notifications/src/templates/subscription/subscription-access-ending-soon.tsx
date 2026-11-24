import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for SubscriptionAccessEndingSoon email template (SPEC-147 T-010).
 *
 * Sent ~3 days before a soft-cancelled subscription's `current_period_end`
 * by the `finalize-cancelled-subs` cron. The subscription is still active;
 * the email nudges the user to reactivate before access is lost.
 */
export interface SubscriptionAccessEndingSoonProps {
    readonly recipientName: string;
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end.
     * Access will be revoked on this date if the sub is not reactivated.
     */
    readonly accessUntil: string;
    /**
     * Number of days remaining until access is lost (ceiling-rounded).
     */
    readonly daysRemaining: number;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * D3 "access ending soon" reminder email template (SPEC-147 T-010).
 *
 * Sent approximately 3 days before the soft-cancelled subscription's
 * `current_period_end`. Unlike the cancel-confirmed email (T-004), this is
 * a reminder — the user can still reactivate before access is revoked.
 *
 * @param props - D3 access-ending reminder data
 */
export function SubscriptionAccessEndingSoon({
    recipientName,
    planName,
    accessUntil,
    daysRemaining,
    baseUrl
}: SubscriptionAccessEndingSoonProps) {
    const formattedAccessUntil = formatDate({ dateString: accessUntil });

    return (
        <EmailLayout
            previewText={`Tu acceso al plan ${planName} termina en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}: reactivá tu suscripción`}
        >
            <Heading>Tu acceso está por terminar</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te recordamos que tu acceso al plan <strong>{planName}</strong> termina en{' '}
                <strong>
                    {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                </strong>
                . Después de esa fecha, tu cuenta vuelve al plan gratuito.
            </Text>

            <Text style={styles.accessBanner}>
                Tu acceso vence el <strong>{formattedAccessUntil}</strong>.
            </Text>

            <Callout tone="warning">
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Acceso hasta"
                    value={formattedAccessUntil}
                />
                <InfoRow
                    label="Días restantes"
                    value={String(daysRemaining)}
                />
            </Callout>

            <Text style={styles.paragraph}>
                Para conservar tus funciones y límites actuales, reactivá tu suscripción antes del{' '}
                {formattedAccessUntil}.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Reactivar suscripción</Button>

            <Text style={styles.footer}>
                Si querías cancelar, no tenés que hacer nada. Tu acceso termina automáticamente el{' '}
                {formattedAccessUntil} y no se te van a hacer más cobros.
            </Text>
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
        color: '#b45309',
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '600',
        margin: '0 0 16px'
    },
    footer: {
        color: '#94a3b8',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 16px'
    }
};
