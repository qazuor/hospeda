import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';

/** Props for the CourtesyEnded email template (HOS-180). */
export interface CourtesyEndedProps {
    readonly recipientName: string;
    readonly planName: string;
    /** Localised date of the next charge now that billing has resumed. */
    readonly nextBillingDate: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Sent when the gifted window closes and normal billing resumes.
 *
 * The last of three (HOS-180), and the one with a hard timing requirement: it
 * must reach the subscriber **before or with** the resume, never after a charge
 * has landed. Someone who sees an unexpected charge reads it as a bug, and a
 * warning that arrives afterwards is not a warning.
 */
export function CourtesyEnded({
    recipientName,
    planName,
    nextBillingDate,
    baseUrl
}: CourtesyEndedProps) {
    return (
        <EmailLayout
            previewText={`Tu regalo terminó — la facturación se reanuda el ${nextBillingDate}`}
        >
            <Heading>Tu regalo terminó</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Los períodos que te regalamos de tu plan <strong>{planName}</strong> ya se usaron.
                Gracias por seguir con nosotros.
            </Text>

            <Callout tone="info">
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Estado"
                    value="Activa"
                />
                <InfoRow
                    label="Próximo cobro"
                    value={nextBillingDate}
                />
            </Callout>

            <Text style={styles.paragraph}>
                A partir de ahora la facturación vuelve a la normalidad, con el mismo medio de pago
                que ya tenías. No hace falta que hagas nada.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Ver mi suscripción</Button>
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
    }
};
