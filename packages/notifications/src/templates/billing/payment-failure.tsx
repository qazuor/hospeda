import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/index.js';

/**
 * Props for PaymentFailure email template
 */
export interface PaymentFailureProps {
    recipientName: string;
    amount: number;
    currency: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    failureReason?: string;
    retryDate?: string;
}

/**
 * Payment failure email template
 * Sent when a payment attempt fails
 *
 * @param props - Payment failure data
 */
export function PaymentFailure({
    recipientName,
    amount,
    currency,
    baseUrl,
    failureReason,
    retryDate
}: PaymentFailureProps) {
    const formattedAmount = formatCurrency({ amount, currency });
    const formattedRetryDate = retryDate ? formatDate({ dateString: retryDate }) : undefined;

    return (
        <EmailLayout previewText="Error al procesar tu pago">
            <Heading>No se pudo procesar tu pago</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Intentamos procesar tu pago pero no fue posible completar la transacción.
            </Text>

            <Section style={styles.alertBox}>
                <InfoRow
                    label="Monto"
                    value={formattedAmount}
                />
                {failureReason && (
                    <InfoRow
                        label="Motivo"
                        value={failureReason}
                    />
                )}
                {formattedRetryDate && (
                    <InfoRow
                        label="Próximo intento"
                        value={formattedRetryDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Para evitar la interrupción de tu servicio, te recomendamos actualizar tu método de
                pago lo antes posible.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>
                    Actualizar método de pago
                </Button>
            </Section>

            <Text style={styles.footerNote}>
                Si necesitas ayuda, nuestro equipo de soporte está disponible para asistirte.
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
    alertBox: {
        backgroundColor: '#fef2f2',
        borderRadius: '8px',
        borderLeft: '4px solid #ef4444',
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
