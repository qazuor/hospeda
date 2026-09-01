import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/** Props for the CourtesyStarted email template (HOS-180). */
export interface CourtesyStartedProps {
    readonly recipientName: string;
    readonly planName: string;
    /** Localised date the gift ends and normal billing resumes. */
    readonly endsAt: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Sent when the gifted window actually begins — the period the subscriber had
 * already paid for has run out and the free cycles start now.
 *
 * The second of three (HOS-180). Its whole job is to make the gift visible at
 * the moment it becomes real, so the subscriber notices the month they were not
 * charged instead of it passing unremarked.
 */
export function CourtesyStarted({
    recipientName,
    planName,
    endsAt,
    baseUrl
}: CourtesyStartedProps) {
    return (
        <EmailLayout
            previewText={`Tu regalo ya está activo: no te cobramos hasta el ${endsAt}`}
            showUnsubscribe={false}
        >
            <Heading>Tu regalo ya está activo</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Desde hoy, tu plan <strong>{planName}</strong> corre por nuestra cuenta.{' '}
                <strong>No vamos a hacerte ningún cargo hasta el {endsAt}.</strong>
            </Text>

            <Section style={styles.giftBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Estado"
                    value="De regalo"
                />
                <InfoRow
                    label="Próximo cobro"
                    value={endsAt}
                />
            </Section>

            <Text style={styles.paragraph}>
                Tenés todo tu plan disponible, sin ninguna limitación. Cuando el regalo termine, la
                facturación se reanuda sola con tu medio de pago actual.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>Ver mi suscripción</Button>
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
