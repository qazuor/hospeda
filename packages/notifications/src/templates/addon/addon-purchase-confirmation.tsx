import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/index.js';

/**
 * Props for AddonPurchaseConfirmation email template
 */
export interface AddonPurchaseConfirmationProps {
    /** Customer display name */
    readonly customerName: string;
    /** Human-readable addon name */
    readonly addonName: string;
    /** Short description of what the addon provides */
    readonly addonDescription: string;
    /** Expiration date (ISO 8601). Null for lifetime addons. */
    readonly expiresAt: string | null;
    /** Order/payment identifier */
    readonly orderId: string;
    /** Amount in centavos (e.g. 150000 = $1,500.00) */
    readonly amount: number;
    /** ISO 4217 currency code (defaults to 'ARS') */
    readonly currency?: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Addon purchase confirmation email template.
 * Sent immediately after a successful addon purchase to confirm the transaction
 * and summarize what the customer received.
 *
 * @param props - Purchase confirmation data
 */
export function AddonPurchaseConfirmation({
    customerName,
    addonName,
    addonDescription,
    expiresAt,
    orderId,
    amount,
    currency = 'ARS',
    baseUrl
}: AddonPurchaseConfirmationProps) {
    const formattedAmount = formatCurrency({ amount, currency });
    const formattedExpiresAt = expiresAt ? formatDate({ dateString: expiresAt }) : null;

    return (
        <EmailLayout previewText={`Compra confirmada: ${addonName}`}>
            <Heading>Complemento adquirido exitosamente</Heading>

            <Text style={styles.greeting}>Hola {customerName},</Text>

            <Text style={styles.paragraph}>
                Tu compra del complemento <strong>{addonName}</strong> ha sido procesada
                exitosamente.
            </Text>

            <Section style={styles.successBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                <InfoRow
                    label="Descripción"
                    value={addonDescription}
                />
                <InfoRow
                    label="Monto"
                    value={formattedAmount}
                />
                <InfoRow
                    label="Orden"
                    value={orderId}
                />
                {formattedExpiresAt ? (
                    <InfoRow
                        label="Vigencia hasta"
                        value={formattedExpiresAt}
                    />
                ) : (
                    <InfoRow
                        label="Vigencia"
                        value="Sin vencimiento"
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Las funcionalidades de este complemento ya están disponibles en tu cuenta. Puedes
                comenzar a utilizarlas de inmediato.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>Ver mis complementos</Button>
            </Section>

            <Text style={styles.footerNote}>
                Gracias por tu compra. Si tenés alguna consulta, no dudes en contactarnos.
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
