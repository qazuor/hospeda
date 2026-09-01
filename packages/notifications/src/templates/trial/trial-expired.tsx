import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 4 of 9 — expiry day itself, offset 0 (HOS-1012 §4, T-031).
 *
 * The only send in the series that REPORTS something instead of warning about
 * it: the listing has already come down. That is why its copy has to differ in
 * kind from the T−1 warning that preceded it by a day and from the +1 win-back
 * that follows it — those three land inside 48 hours, and reading as one
 * message repeated three times is the failure mode.
 *
 * It is also the only one of the nine classified TRANSACTIONAL. Someone who
 * opted out of reminders and then finds their listing gone with no notice reads
 * it as the platform having deleted it, so this send goes out regardless of
 * preferences.
 *
 * @param props - Trial series email data
 */
export function TrialExpired({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl
}: TrialSeriesEmailProps) {
    const formattedEndDate = formatDate({ dateString: trialEndDate });

    return (
        <EmailLayout
            previewText="Terminó tu prueba y tu publicación dejó de verse"
            showUnsubscribe={false}
        >
            <Heading>Tu publicación salió del sitio</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Hoy {formattedEndDate} terminó tu prueba gratis del plan <strong>{planName}</strong>{' '}
                y, como te avisamos, tu alojamiento dejó de aparecer en Hospeda. Te escribimos para
                que sepas exactamente qué pasó y no te enteres cuando alguien no te encuentre.
            </Text>

            <Section style={styles.alertBox}>
                <Text style={styles.paragraph}>
                    <strong>No se borró nada.</strong> Tu ficha completa —fotos, descripción,
                    servicios, ubicación y datos de contacto— quedó guardada en tu cuenta, tal como
                    la dejaste. Lo único que cambió es que ya no se muestra en el sitio ni en las
                    búsquedas.
                </Text>
            </Section>

            <Text style={styles.paragraph}>
                Para volver a estar online alcanza con elegir un plan. Tu publicación vuelve a
                aparecer en el momento, sin que tengas que cargar nada de nuevo.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Volver a publicar</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si decidiste no seguir, gracias por haberlo probado. Este mail es informativo: no
                hay ningún cobro pendiente ni nada que tengas que cancelar.
            </Text>
        </EmailLayout>
    );
}
