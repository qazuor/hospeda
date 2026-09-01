import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/** Props for the CourtesyGranted email template (HOS-180). */
export interface CourtesyGrantedProps {
    readonly recipientName: string;
    readonly planName: string;
    /** How many billing cycles were gifted. */
    readonly cycles: number;
    /** Localised date the gift begins (end of the period already paid for). */
    readonly startsAt: string;
    /** Localised date the gift ends and normal billing resumes. */
    readonly endsAt: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Sent the moment an admin grants a courtesy — before it starts.
 *
 * Granting and starting are two different moments (HOS-180 OQ-4): the gift
 * begins when the period the subscriber already paid for runs out. This email
 * says what was given and when it kicks in; a second one says it started.
 *
 * The tone matters as much as the facts. This is a gift, and it must never read
 * like the pause notice underneath it — the subscriber's preapproval IS paused
 * in MercadoPago, but nothing is suspended for them.
 */
export function CourtesyGranted({
    recipientName,
    planName,
    cycles,
    startsAt,
    endsAt,
    baseUrl
}: CourtesyGrantedProps) {
    const cycleLabel = cycles === 1 ? 'un período' : `${cycles} períodos`;

    return (
        <EmailLayout
            previewText={`Te regalamos ${cycleLabel} de tu plan ${planName}`}
            showUnsubscribe={false}
        >
            <Heading>Te regalamos {cycleLabel}</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Queremos agradecerte por confiar en nosotros, así que{' '}
                <strong>
                    {cycleLabel} de tu plan {planName} corren por nuestra cuenta
                </strong>
                .
            </Text>

            <Section style={styles.giftBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Períodos de regalo"
                    value={String(cycles)}
                />
                <InfoRow
                    label="Empieza el"
                    value={startsAt}
                />
                <InfoRow
                    label="Termina el"
                    value={endsAt}
                />
            </Section>

            <Text style={styles.paragraph}>
                No tenés que hacer nada. Seguís usando tu cuenta con todo incluido, tal como hasta
                ahora. El período que ya pagaste sigue su curso normal, y el regalo empieza cuando
                ese período termina.
            </Text>

            <Text style={styles.paragraph}>
                Cuando el regalo termine, la facturación vuelve a la normalidad de forma automática
                y con el mismo medio de pago. No vamos a pedirte los datos de tu tarjeta otra vez.
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
