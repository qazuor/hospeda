import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for PaymentSuccess email template
 */
export interface PaymentSuccessProps {
    recipientName: string;
    amount: number;
    currency: string;
    planName: string;
    paymentMethod?: string;
}

/**
 * Payment success email template
 * Sent when a payment is successfully processed
 *
 * @param props - Payment success data
 */
export function PaymentSuccess({
    recipientName,
    amount,
    currency,
    planName,
    paymentMethod
}: PaymentSuccessProps) {
    const formattedAmount = formatCurrency(amount, currency);

    return (
        <EmailLayout previewText="Pago procesado exitosamente">
            <Heading>Pago confirmado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu pago ha sido procesado exitosamente. Gracias por mantener tu suscripción activa.
            </Text>

            <Section style={styles.receiptBox}>
                <InfoRow
                    label="Concepto"
                    value={planName}
                />
                <InfoRow
                    label="Monto"
                    value={formattedAmount}
                />
                {paymentMethod && (
                    <InfoRow
                        label="Método de pago"
                        value={paymentMethod}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Puedes descargar tu recibo desde tu panel de facturación.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href="{{base_url}}/mi-cuenta/billing">Ver recibo</Button>
            </Section>

            <Text style={styles.footerNote}>Este correo confirma el pago de tu suscripción.</Text>
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
