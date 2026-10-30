import { Section, Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/** Aviso de dos días antes del fin de la prueba. */
export function TrialEnding2Days({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl,
    verticals
}: TrialSeriesEmailProps) {
    const endDate = formatDate({ dateString: trialEndDate });
    return (
        <EmailLayout
            previewText="Quedan 2 días de tu prueba gratis"
            showUnsubscribe={true}
        >
            <Heading>Te quedan 2 días de prueba</Heading>
            <Text style={styles.greeting}>Hola {recipientName},</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluye {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}
            <Text style={styles.paragraph}>
                En dos días termina tu prueba del plan {planName}. Después, tu publicación deja de
                aparecer en Hospeda hasta que elijas un plan.
            </Text>
            <Section style={styles.warningBox}>
                <Text style={styles.paragraph}>
                    Tu prueba termina el {endDate}. Lo que cargaste queda guardado.
                </Text>
            </Section>
            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Elegir mi plan</Button>
            </Section>
        </EmailLayout>
    );
}
