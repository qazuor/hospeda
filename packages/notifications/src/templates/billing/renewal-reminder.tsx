import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for RenewalReminder email template
 */
export interface RenewalReminderProps {
    recipientName: string;
    planName: string;
    amount: number;
    currency: string;
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
    amount,
    currency,
    renewalDate
}: RenewalReminderProps) {
    const formattedAmount = formatCurrency(amount, currency);
    const formattedRenewalDate = renewalDate ? formatDate(renewalDate) : 'próximamente';

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
                <InfoRow
                    label="Monto"
                    value={formattedAmount}
                />
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
                <Button href="{{base_url}}/mi-cuenta/subscription">Gestionar suscripción</Button>
            </Section>

            <Text style={styles.footerNote}>
                Gracias por confiar en Hospeda para tus necesidades de alojamiento turístico.
            </Text>
        </EmailLayout>
    );
}

/**
 * Format currency amount in Argentine Peso format
 * @param amount - Amount in cents
 * @param currency - Currency code (ARS, USD, etc.)
 */
function formatCurrency(amount: number, currency: string): string {
    const amountInUnits = amount / 100;
    const formatted = amountInUnits.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const currencySymbol = currency === 'ARS' ? '$' : currency === 'USD' ? 'USD ' : '';
    return `${currencySymbol}${formatted}`;
}

/**
 * Format date in Spanish locale
 * @param dateString - ISO date string
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
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
