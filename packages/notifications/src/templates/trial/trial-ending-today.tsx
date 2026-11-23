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

/** Aviso enviado antes de que venza la prueba durante el día de hoy. */
export function TrialEndingToday({
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
            previewText="Hoy termina tu prueba gratis"
            footerLink="none"
        >
            <Heading>Hoy termina tu prueba gratis</Heading>
            <Text style={styles.greeting}>{formatTrialGreeting({ recipientName })}</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluye {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}
            <Callout tone="warning">
                <Text style={styles.paragraph}>
                    Hoy {endDate} termina tu prueba gratis{planFragment}. Si elegís un plan antes de
                    que termine el día, tu publicación sigue visible sin cortes.
                </Text>
            </Callout>
            <Text style={styles.paragraph}>Tu ficha y todo lo que cargaste quedan guardados.</Text>
            <Button href={upgradeUrl}>Elegir un plan ahora</Button>
        </EmailLayout>
    );
}
