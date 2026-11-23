import { Text } from '@react-email/components';
import { Button, EmailLayout } from '@repo/email';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { formatDate } from '../utils/index.js';
import {
    formatTrialGreeting,
    trialSeriesStyles as styles,
    type TrialSeriesEmailProps
} from './trial-series-shared.js';

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
            footerLink="none"
        >
            <Heading>Tu publicación puede volver cuando quieras</Heading>
            <Text style={styles.greeting}>{formatTrialGreeting({ recipientName })}</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluía {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}
            <Text style={styles.paragraph}>
                Hace quince días terminó tu prueba, el {endDate}. Tu publicación sigue guardada y
                puede volver a aparecer cuando elijas un plan.
            </Text>
            <Button href={upgradeUrl}>Ver los planes</Button>
        </EmailLayout>
    );
}
