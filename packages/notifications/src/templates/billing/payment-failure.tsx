import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency } from '../utils/index.js';

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
    /**
     * HOS-937 step 3 — when set, this failure is a checkout that never
     * activated (MercadoPago cancelled the preapproval over a card
     * rejection). The email switches to a "go retry" CTA instead of the
     * "we'll retry automatically" copy, which does not apply here: nothing
     * ever activated, so there is no recurring charge for MercadoPago to
     * retry.
     *
     * NOT a MercadoPago `init_point` — a link into Hospeda's own account
     * page (`mi-cuenta/suscripcion`). No fresh preapproval exists yet at
     * send time; minting one only happens later, through the
     * checkout-retry endpoint (spec §6.5 redesign — the webhook that sends
     * this email never mints). The front-end wiring that calls that
     * endpoint automatically from this landing page is a separate,
     * pending piece of work; today the link is honest about WHERE to go,
     * not a claim that clicking it instantly completes anything. The copy
     * below must stay truthful to that: it offers to GENERATE a new
     * attempt, not to complete one that already exists.
     */
    retryUrl?: string;
}

/**
 * Payment failure email template
 * Sent when a payment attempt fails, OR (HOS-937 step 3, `retryUrl` set)
 * when a checkout was cancelled by MercadoPago before it ever activated.
 *
 * @param props - Payment failure data
 */
export function PaymentFailure({
    recipientName,
    amount,
    currency,
    baseUrl,
    failureReason,
    retryUrl
}: PaymentFailureProps) {
    const formattedAmount = formatCurrency({ amount, currency });
    const isCancelledCheckoutRetry = Boolean(retryUrl);

    return (
        <EmailLayout previewText="Error al procesar tu pago">
            <Heading>No se pudo procesar tu pago</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Intentamos procesar tu pago pero no fue posible completar la transacción.
            </Text>

            <Section style={styles.alertBox}>
                {!isCancelledCheckoutRetry && (
                    <InfoRow
                        label="Monto"
                        value={formattedAmount}
                    />
                )}
                {failureReason && (
                    <InfoRow
                        label="Motivo"
                        value={failureReason}
                    />
                )}
            </Section>

            {isCancelledCheckoutRetry ? (
                <Text style={styles.paragraph}>
                    Tu suscripción no llegó a activarse porque MercadoPago rechazó la tarjeta. Entrá
                    a tu cuenta para generar un nuevo intento de pago.
                </Text>
            ) : (
                <Text style={styles.paragraph}>
                    Vamos a reintentar el cobro automáticamente. Para evitar la interrupción de tu
                    servicio, te recomendamos actualizar tu método de pago lo antes posible.
                </Text>
            )}

            <Section style={styles.buttonContainer}>
                {isCancelledCheckoutRetry && retryUrl ? (
                    <Button href={retryUrl}>Ir a mi cuenta</Button>
                ) : (
                    <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>
                        Actualizar método de pago
                    </Button>
                )}
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
