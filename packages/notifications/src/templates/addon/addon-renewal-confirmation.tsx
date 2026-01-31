import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for AddonRenewalConfirmation email template
 */
export interface AddonRenewalConfirmationProps {
    recipientName: string;
    addonName: string;
    amount?: number;
    currency?: string;
    expirationDate?: string;
}

/**
 * Addon renewal confirmation email template
 * Sent when an addon is successfully renewed
 *
 * @param props - Addon renewal data
 */
export function AddonRenewalConfirmation({
    recipientName,
    addonName,
    amount,
    currency,
    expirationDate
}: AddonRenewalConfirmationProps) {
    const formattedAmount = amount && currency ? formatCurrency(amount, currency) : undefined;
    const formattedExpirationDate = expirationDate ? formatDate(expirationDate) : undefined;

    return (
        <EmailLayout previewText={`Renovación confirmada: ${addonName}`}>
            <Heading>Complemento renovado exitosamente</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu complemento <strong>{addonName}</strong> ha sido renovado exitosamente.
            </Text>

            <Section style={styles.successBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                {formattedAmount && (
                    <InfoRow
                        label="Monto"
                        value={formattedAmount}
                    />
                )}
                {formattedExpirationDate && (
                    <InfoRow
                        label="Próxima renovación"
                        value={formattedExpirationDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Puedes continuar disfrutando de todas las funcionalidades de este complemento sin
                interrupciones.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href="{{base_url}}/mi-cuenta/addons">Ver mis complementos</Button>
            </Section>

            <Text style={styles.footerNote}>Gracias por confiar en nuestros servicios.</Text>
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
    successBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
        borderLeft: '4px solid #22c55e',
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
