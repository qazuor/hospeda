import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 7 of 9 — ten days after expiry (HOS-1012 §4).
 *
 * Answers the objection that grows with time rather than shrinking: after a
 * week and media the host no longer remembers how much work loading the ficha
 * was, only that it was work, and assumes coming back means doing it again. So
 * this send is an inventory — here is literally what is still saved — instead
 * of another invitation.
 *
 * No commercial hook (OQ-1 open) — see `trial-win-back-1d.tsx`.
 *
 * @param props - Trial series email data
 */
export function TrialWinBack10Days({
    recipientName,
    trialEndDate,
    upgradeUrl
}: TrialSeriesEmailProps) {
    const formattedEndDate = formatDate({ dateString: trialEndDate });

    return (
        <EmailLayout
            previewText="No tenés que cargar nada de nuevo: está todo como lo dejaste"
            showUnsubscribe={true}
        >
            <Heading>Tus fotos y tus datos siguen guardados</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Pasaron diez días desde que tu publicación salió del sitio y queremos sacarte una
                duda de encima: volver no es empezar de cero.
            </Text>

            <Section style={styles.calmBox}>
                <InfoRow
                    label="Tus fotos"
                    value="Guardadas, en el mismo orden"
                />
                <InfoRow
                    label="Descripción y servicios"
                    value="Tal como los escribiste"
                />
                <InfoRow
                    label="Ubicación y contacto"
                    value="Sin cambios"
                />
                <InfoRow
                    label="Guardado desde"
                    value={formattedEndDate}
                />
            </Section>

            <Text style={styles.paragraph}>
                Elegís un plan y tu ficha vuelve a publicarse exactamente como estaba. No hay nada
                que volver a subir ni a completar.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Publicar de nuevo</Button>
            </Section>
        </EmailLayout>
    );
}
