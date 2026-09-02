import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 2 of 9 — five days before the trial ends (HOS-1012 §4).
 *
 * Still friendly, but this is the first send that names the consequence out
 * loud: when the trial ends the listing stops being visible. Five days is
 * enough room to decide without pressure and short enough that not saying it
 * would be withholding the one fact that matters.
 *
 * @param props - Trial series email data
 */
export function TrialEnding5Days({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl
}: TrialSeriesEmailProps) {
    const formattedEndDate = formatDate({ dateString: trialEndDate });

    return (
        <EmailLayout
            previewText={`Tu prueba del plan ${planName} termina en 5 días`}
            showUnsubscribe={true}
        >
            <Heading>Te quedan 5 días de prueba</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Queríamos avisarte con tiempo: tu prueba gratis termina en cinco días. Después de
                esa fecha, tu publicación deja de aparecer en Hospeda hasta que elijas un plan.
            </Text>

            <Section style={styles.warningBox}>
                <InfoRow
                    label="Plan de prueba"
                    value={planName}
                />
                <InfoRow
                    label="Último día"
                    value={formattedEndDate}
                />
                <InfoRow
                    label="Qué pasa ese día"
                    value="Tu ficha deja de estar visible"
                />
            </Section>

            <Text style={styles.paragraph}>
                No perdés nada de lo que cargaste. Tus fotos, tu descripción, tus servicios y tus
                datos quedan guardados tal como están; lo único que cambia es que dejan de verse
                mientras no haya un plan activo.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Elegir mi plan</Button>
            </Section>

            <Text style={styles.footerNote}>
                ¿Tenés dudas sobre cuál te conviene? Respondé este mail y lo vemos juntos.
            </Text>
        </EmailLayout>
    );
}
