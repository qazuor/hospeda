import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 8 of 9 — a month after expiry (HOS-1012 §4).
 *
 * A month is long enough that the reason for not continuing was probably not
 * the platform at all: the season changed, the alojamiento was closed, the
 * decision was postponed. So this send asks rather than argues, and it is the
 * only one in the series that treats "no" as a perfectly good answer worth
 * writing back with.
 *
 * No commercial hook (OQ-1 open) — see `trial-win-back-1d.tsx`.
 *
 * @param props - Trial series email data
 */
export function TrialWinBack30Days({ recipientName, upgradeUrl }: TrialSeriesEmailProps) {
    return (
        <EmailLayout
            previewText="Pasó un mes: ¿es buen momento para volver a publicar?"
            showUnsubscribe={true}
        >
            <Heading>¿Retomamos tu publicación?</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Pasó un mes desde que probaste Hospeda. A veces no es que la plataforma no sirva: es
                que era temporada baja, que el alojamiento estaba cerrado, o que había cosas más
                urgentes esa semana.
            </Text>

            <Text style={styles.paragraph}>
                Si ahora es un mejor momento, tu publicación sigue guardada y vuelve online en
                cuanto elijas un plan.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Retomar mi publicación</Button>
            </Section>

            <Section style={styles.calmBox}>
                <Text style={styles.paragraph}>
                    Y si la respuesta es no, también nos sirve saberlo. Respondé este mail con una
                    línea contándonos qué faltó: es la forma más directa que tenemos de mejorar la
                    plataforma.
                </Text>
            </Section>
        </EmailLayout>
    );
}
