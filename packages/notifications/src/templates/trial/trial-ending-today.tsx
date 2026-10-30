import { Section, Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/** Aviso enviado antes de que venza la prueba durante el día de hoy. */
export function TrialEndingToday({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl,
    verticals
}: TrialSeriesEmailProps) {
    const endDate = formatDate({ dateString: trialEndDate });
    return (
        <EmailLayout
            previewText="Hoy termina tu prueba gratis"
            showUnsubscribe={true}
        >
            <Heading>Hoy termina tu prueba gratis</Heading>
            <Text style={styles.greeting}>Hola {recipientName},</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluye {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}
            <Section style={styles.warningBox}>
                <Text style={styles.paragraph}>
                    Hoy {endDate} termina tu prueba gratis del plan {planName}. Si elegís un plan
                    antes de que termine el día, tu publicación sigue visible sin cortes.
                </Text>
            </Section>
            <Text style={styles.paragraph}>Tu ficha y todo lo que cargaste quedan guardados.</Text>
            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Elegir un plan ahora</Button>
            </Section>
        </EmailLayout>
    );
}
