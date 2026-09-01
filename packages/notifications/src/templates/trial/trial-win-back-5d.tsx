import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 6 of 9 — five days after expiry (HOS-1012 §4).
 *
 * Shifts the subject from the listing to the people looking for one. A week
 * after the fact, "tu ficha sigue guardada" is no longer news; what is worth
 * saying is what happens meanwhile — the searches keep coming and the ficha is
 * not in them.
 *
 * No commercial hook (OQ-1 open) — see `trial-win-back-1d.tsx`.
 *
 * @param props - Trial series email data
 */
export function TrialWinBack5Days({ recipientName, upgradeUrl }: TrialSeriesEmailProps) {
    return (
        <EmailLayout
            previewText="Hay gente buscando alojamiento en tu zona ahora mismo"
            showUnsubscribe={true}
        >
            <Heading>Volvé a aparecer en Hospeda</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Todos los días entra gente a Hospeda buscando dónde quedarse en el Litoral: fines de
                semana largos, escapadas a las termas, familias que arman las vacaciones con meses
                de anticipación.
            </Text>

            <Section style={styles.calmBox}>
                <Text style={styles.paragraph}>
                    Cada día que tu publicación está fuera del sitio son búsquedas en las que tu
                    alojamiento no aparece. No es una penalización ni nada que se acumule en tu
                    contra: simplemente no estás en la lista.
                </Text>
            </Section>

            <Text style={styles.paragraph}>
                Si querés volver, tu ficha está lista para publicarse de nuevo en cuanto elijas un
                plan.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Ver los planes</Button>
            </Section>
        </EmailLayout>
    );
}
