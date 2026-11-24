import { Section, Text } from '@react-email/components';
import { Button, EMAIL_TINTED_BOX_CLASS, EmailLayout, emailPalette } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatBillingCycleLabel, formatCurrency, formatDate } from '../utils/index.js';

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

            <Text style={styles.paragraph}>Tu compra quedó confirmada. Acá tenés el detalle:</Text>

            <Section
                className={EMAIL_TINTED_BOX_CLASS}
                style={styles.receiptBox}
            >
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
                        value={formatBillingCycleLabel({ cycle: billingPeriod })}
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
                Podés gestionar tu suscripción y ver tus facturas cuando quieras desde tu cuenta.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/`}>Ver mi cuenta</Button>

            <Text style={styles.footerNote}>Si tenés alguna pregunta, escribinos.</Text>
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
        backgroundColor: emailPalette.pageBackground,
        border: `1px solid ${emailPalette.border}`,
        borderRadius: '8px',
        padding: '24px',
        margin: '24px 0'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
