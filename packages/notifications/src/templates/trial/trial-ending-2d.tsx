import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { formatDate } from '../utils/index.js';
import {
    formatTrialGreeting,
    resolveTrialPlanName,
    trialSeriesStyles as styles,
    type TrialSeriesEmailProps
} from './trial-series-shared.js';

/** Aviso de dos días antes del fin de la prueba. */
export function TrialEnding2Days({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl,
    verticals
}: TrialSeriesEmailProps) {
    const plan = resolveTrialPlanName({ planName });
    const planFragment = plan ? ` del plan ${plan}` : '';
    const endDate = formatDate({ dateString: trialEndDate });
    return (
        <EmailLayout
            previewText="Quedan 2 días de tu prueba gratis"
            footerLink="none"
        >
            <Heading>Te quedan 2 días de prueba</Heading>
            <Text style={styles.greeting}>{formatTrialGreeting({ recipientName })}</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluye {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}
            <Text style={styles.paragraph}>
                En dos días termina tu prueba{planFragment}. Después, tu publicación deja de
                aparecer en Hospeda hasta que elijas un plan.
            </Text>
            <Callout tone="warning">
                <Text style={styles.paragraph}>
                    Tu prueba termina el {endDate}. Lo que cargaste queda guardado.
                </Text>
            </Callout>
            <Button href={upgradeUrl}>Elegir mi plan</Button>
        </EmailLayout>
    );
}
