import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/** Props for the CompGranted email template (HOS-1171). */
export interface CompGrantedProps {
    readonly recipientName: string;
    readonly planName: string;
    /**
     * Whether a live MercadoPago preapproval was hard-cancelled to make room
     * for this grant. Decides whether the "we stopped charging your card"
     * paragraph appears at all.
     */
    readonly hadActiveBilling: boolean;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Sent the moment an operator grants a permanently-complimentary subscription.
 *
 * Not a variant of `courtesy-granted.tsx`, and the difference is not cosmetic.
 * A courtesy is finite: it names a start date, an end date, and promises that
 * billing resumes automatically with the same card. Every one of those
 * sentences is false here — a comp never ends and there is no card left to
 * resume against, because the preapproval was destroyed rather than paused.
 *
 * The `hadActiveBilling` branch exists for the same reason. A customer who was
 * paying needs to read that their card will not be charged again; a customer
 * who never gave us one must not read a sentence about a card they never gave.
 */
export function CompGranted({
    recipientName,
    planName,
    hadActiveBilling,
    baseUrl
}: CompGrantedProps) {
    return (
        <EmailLayout
            previewText={`Tu plan ${planName} queda sin cargo`}
            showUnsubscribe={false}
        >
            <Heading>Tu plan queda sin cargo</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te dejamos <strong>el plan {planName} sin cargo, de forma permanente</strong>.
                Conservás todo lo que el plan incluye y no hay nada que renovar.
            </Text>

            <Section style={styles.giftBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Costo"
                    value="Sin cargo"
                />
                <InfoRow
                    label="Vencimiento"
                    value="No vence"
                />
            </Section>

            {hadActiveBilling ? (
                <Text style={styles.paragraph}>
                    Cancelamos el débito automático que tenías con nosotros, así que{' '}
                    <strong>no vamos a hacer más cobros a tu tarjeta</strong>. Si ves un cargo
                    posterior a este correo, escribinos y lo revisamos.
                </Text>
            ) : null}

            <Text style={styles.paragraph}>
                No tenés que hacer nada. Seguí usando tu cuenta como siempre.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Ver mi suscripción</Button>
            </Section>
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
    giftBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
        borderLeft: '4px solid #8CC63F',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    }
};
