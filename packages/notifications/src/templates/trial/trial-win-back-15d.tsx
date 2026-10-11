import { Section, Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/** Aviso de recuperación quince días después del fin de la prueba. */
export function TrialWinBack15Days({
    recipientName,
    trialEndDate,
    upgradeUrl,
    verticals
}: TrialSeriesEmailProps) {
    const endDate = formatDate({ dateString: trialEndDate });
    return (
        <EmailLayout
            previewText="Tu publicación puede volver cuando quieras"
            showUnsubscribe={true}
        >
            <Heading>Tu publicación puede volver cuando quieras</Heading>
            <Text style={styles.greeting}>Hola {recipientName},</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluía {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}
            <Text style={styles.paragraph}>
                Hace quince días terminó tu prueba, el {endDate}. Tu publicación sigue guardada y
                puede volver a aparecer cuando elijas un plan.
            </Text>
            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Ver los planes</Button>
            </Section>
        </EmailLayout>
    );
}
