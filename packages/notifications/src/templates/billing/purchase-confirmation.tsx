import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/index.js';

/**
 * Props for PurchaseConfirmation email template
 */
export interface PurchaseConfirmationProps {
    recipientName: string;
    planName: string;
    amount: number;
    currency: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    billingPeriod?: string;
    nextBillingDate?: string;
}

/**
 * Purchase confirmation email template
 * Sent when a user purchases a subscription or addon
 *
 * @param props - Purchase confirmation data
 */
export function PurchaseConfirmation({
    recipientName,
    planName,
    amount,
    currency,
    baseUrl,
    billingPeriod,
    nextBillingDate
}: PurchaseConfirmationProps) {
    const formattedAmount = formatCurrency({ amount, currency });
    const formattedNextBilling = nextBillingDate
        ? formatDate({ dateString: nextBillingDate })
        : undefined;

    return (
        <EmailLayout previewText={`Confirmación de compra: ${planName}`}>
            <Heading>¡Gracias por tu compra!</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu compra ha sido confirmada exitosamente. A continuación encontrarás los detalles
                de tu adquisición:
            </Text>

            <Section style={styles.receiptBox}>
                <InfoRow
                    label="Plan/Complemento"
                    value={planName}
                />
                <InfoRow
                    label="Monto"
                    value={formattedAmount}
                />
                {billingPeriod && (
                    <InfoRow
                        label="Período"
                        value={billingPeriod}
                    />
                )}
                {formattedNextBilling && (
                    <InfoRow
                        label="Próxima facturación"
                        value={formattedNextBilling}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Puedes gestionar tu suscripción y ver tus facturas en cualquier momento desde tu
                cuenta.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta`}>Ver mi cuenta</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si tienes alguna pregunta, no dudes en contactarnos.
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
    receiptBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
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
