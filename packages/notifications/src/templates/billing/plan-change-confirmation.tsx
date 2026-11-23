import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatCurrency, formatDate } from '../utils/index.js';

/**
 * Props for PlanChangeConfirmation email template
 */
export interface PlanChangeConfirmationProps {
    recipientName: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    oldPlanName?: string;
    newPlanName?: string;
    amount?: number;
    currency?: string;
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
    baseUrl,
    oldPlanName,
    newPlanName,
    amount,
    currency,
    renewalDate
}: PlanChangeConfirmationProps) {
    const formattedAmount =
        amount !== undefined && currency ? formatCurrency({ amount, currency }) : undefined;
    const formattedRenewalDate = renewalDate ? formatDate({ dateString: renewalDate }) : undefined;

    return (
        <EmailLayout previewText="Cambio de plan confirmado">
            <Heading>Cambio de plan confirmado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>Tu cambio de plan ha sido procesado exitosamente.</Text>

            <Callout tone="success">
                {oldPlanName && newPlanName && (
                    <InfoRow
                        label="Cambio"
                        value={`${oldPlanName} → ${newPlanName}`}
                    />
                )}
                {formattedAmount && (
                    <InfoRow
                        label="Nuevo monto"
                        value={formattedAmount}
                    />
                )}
                {formattedRenewalDate && (
                    <InfoRow
                        label="Fecha efectiva"
                        value={formattedRenewalDate}
                    />
                )}
            </Callout>

            <Text style={styles.paragraph}>
                Tu próximo cargo será por el nuevo plan. Puedes ver todos los detalles y beneficios
                de tu plan actual desde tu cuenta.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Ver mi plan</Button>

            <Text style={styles.footerNote}>
                Si tienes alguna pregunta sobre los cambios, estamos aquí para ayudarte.
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
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
