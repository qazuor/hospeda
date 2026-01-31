import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for PlanChangeConfirmation email template
 */
export interface PlanChangeConfirmationProps {
    recipientName: string;
    oldPlanName?: string;
    newPlanName?: string;
    amount: number;
    currency: string;
    renewalDate?: string;
}

/**
 * Plan change confirmation email template
 * Sent when a user changes their subscription plan
 *
 * @param props - Plan change data
 */
export function PlanChangeConfirmation({
    recipientName,
    oldPlanName,
    newPlanName,
    amount,
    currency,
    renewalDate
}: PlanChangeConfirmationProps) {
    const formattedAmount = formatCurrency(amount, currency);
    const formattedRenewalDate = renewalDate ? formatDate(renewalDate) : undefined;

    return (
        <EmailLayout previewText="Cambio de plan confirmado">
            <Heading>Cambio de plan confirmado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>Tu cambio de plan ha sido procesado exitosamente.</Text>

            <Section style={styles.infoBox}>
                {oldPlanName && newPlanName && (
                    <InfoRow
                        label="Cambio"
                        value={`${oldPlanName} → ${newPlanName}`}
                    />
                )}
                <InfoRow
                    label="Nuevo monto"
                    value={formattedAmount}
                />
                {formattedRenewalDate && (
                    <InfoRow
                        label="Fecha efectiva"
                        value={formattedRenewalDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Tu próximo cargo será por el nuevo plan. Puedes ver todos los detalles y beneficios
                de tu plan actual desde tu cuenta.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href="{{base_url}}/mi-cuenta/subscription">Ver mi plan</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si tienes alguna pregunta sobre los cambios, estamos aquí para ayudarte.
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
