import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { resolveRenewalReminderFooter } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatCurrency, formatDate } from '../utils/index.js';

/**
 * Props for RenewalReminder email template
 */
export interface RenewalReminderProps {
    recipientName: string;
    planName: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    /** Amount in centavos. Omitted when plan price cannot be resolved. */
    amount?: number;
    /** Currency code (e.g. 'ARS'). Omitted when amount is not available. */
    currency?: string;
    renewalDate?: string;
    /**
     * The subscription's billing vertical (HOS-1283) — the raw
     * product-domain string supplied by the caller, or `null`/`undefined` on
     * a pre-domain row. `RENEWAL_REMINDER` fires for an active subscription in
     * ANY vertical (`notification-schedule.job.ts` does not scope its sweep to
     * accommodation), so the closing line below used to tell every venue,
     * experience, tourist and partner subscriber "gracias por confiar en
     * Hospeda para tus necesidades de alojamiento turístico" — see
     * `resolveRenewalReminderFooter`. Omitted or unrecognized fails open to
     * that original accommodation sentence.
     */
    productDomain?: string | null;
}

/**
 * Renewal reminder email template
 * Sent to remind users of upcoming subscription renewal
 *
 * @param props - Renewal reminder data
 */
export function RenewalReminder({
    recipientName,
    planName,
    baseUrl,
    amount,
    currency,
    renewalDate,
    productDomain
}: RenewalReminderProps) {
    const formattedAmount =
        amount !== undefined && currency ? formatCurrency({ amount, currency }) : undefined;
    const formattedRenewalDate = renewalDate
        ? formatDate({ dateString: renewalDate })
        : 'próximamente';
    const footerLine = resolveRenewalReminderFooter(productDomain);

    return (
        <EmailLayout previewText={`Recordatorio: renovación de ${planName}`}>
            <Heading>Recordatorio de renovación</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripción a <strong>{planName}</strong> se renovará próximamente.
            </Text>

            <Callout tone="info">
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                {formattedAmount && (
                    <InfoRow
                        label="Monto"
                        value={formattedAmount}
                    />
                )}
                <InfoRow
                    label="Fecha de renovación"
                    value={formattedRenewalDate}
                />
            </Callout>

            <Text style={styles.paragraph}>
                El cargo se realizará automáticamente usando tu método de pago registrado. Si deseas
                realizar algún cambio, puedes gestionar tu suscripción desde tu cuenta.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Gestionar suscripción</Button>

            <Text style={styles.footerNote}>{footerLine}</Text>
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
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
