import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
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
    renewalDate
}: RenewalReminderProps) {
    const formattedAmount =
        amount !== undefined && currency ? formatCurrency({ amount, currency }) : undefined;
    const formattedRenewalDate = renewalDate
        ? formatDate({ dateString: renewalDate })
        : 'próximamente';

    return (
        <EmailLayout
            previewText={`Recordatorio: renovación de ${planName}`}
            showUnsubscribe={true}
        >
            <Heading>Recordatorio de renovación</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu suscripción a <strong>{planName}</strong> se renovará próximamente.
            </Text>

            <Section style={styles.infoBox}>
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
            </Section>

            <Text style={styles.paragraph}>
                El cargo se realizará automáticamente usando tu método de pago registrado. Si deseas
                realizar algún cambio, puedes gestionar tu suscripción desde tu cuenta.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>Gestionar suscripción</Button>
            </Section>

            <Text style={styles.footerNote}>
                Gracias por confiar en Hospeda para tus necesidades de alojamiento turístico.
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
    infoBox: {
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        borderLeft: '4px solid #3b82f6',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
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
