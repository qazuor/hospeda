import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for PaymentRetryWarning email template
 */
export interface PaymentRetryWarningProps {
    readonly recipientName: string;
    /** Number of payment failures so far (1-based) */
    readonly failureCount: number;
    /** Maximum number of retries before auto-cancellation */
    readonly maxRetries: number;
    /** Optional masked payment method hint shown to the user */
    readonly paymentMethodHint?: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Payment retry warning email template.
 *
 * Sent when a subscription payment fails and the system will automatically retry.
 * Warns the user how many attempts remain before auto-cancellation and suggests
 * updating their payment method.
 *
 * @param props - Payment retry warning data
 */
export function PaymentRetryWarning({
    recipientName,
    failureCount,
    maxRetries,
    paymentMethodHint,
    baseUrl
}: PaymentRetryWarningProps) {
    const remainingAttempts = maxRetries - failureCount;

    return (
        <EmailLayout
            previewText={`Problema con tu pago - Intento ${failureCount} de ${maxRetries}`}
            showUnsubscribe={false}
        >
            <Heading>Problema con tu pago</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Intentamos procesar tu pago pero no fue posible completarlo. Este es el intento{' '}
                <strong>{failureCount}</strong> de <strong>{maxRetries}</strong>.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Intento"
                    value={`${failureCount} de ${maxRetries}`}
                />
                <InfoRow
                    label="Intentos restantes"
                    value={String(remainingAttempts)}
                />
                {paymentMethodHint && (
                    <InfoRow
                        label="Método de pago"
                        value={paymentMethodHint}
                    />
                )}
            </Section>

            {remainingAttempts > 0 ? (
                <Text style={styles.paragraph}>
                    Todavía tenés <strong>{remainingAttempts}</strong>{' '}
                    {remainingAttempts === 1 ? 'intento restante' : 'intentos restantes'} antes de
                    que tu suscripción sea cancelada automáticamente. Te recomendamos actualizar tu
                    método de pago para evitar interrupciones en el servicio.
                </Text>
            ) : (
                <Text style={styles.warningParagraph}>
                    Este es tu último intento disponible. Si el próximo pago falla, tu suscripción
                    será cancelada automáticamente. Actualizá tu método de pago a la brevedad.
                </Text>
            )}

            <Text style={styles.paragraph}>
                Si ya actualizaste tu método de pago, podés ignorar este mensaje. El sistema
                reintentará el cobro automáticamente.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/cuenta/facturacion`}>Actualizar método de pago</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si necesitás ayuda, contactá a nuestro equipo de soporte.
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
    warningParagraph: {
        color: '#b45309',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px',
        fontWeight: '600' as const
    },
    infoBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #dc2626',
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
