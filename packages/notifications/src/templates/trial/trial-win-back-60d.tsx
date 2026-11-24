import { Text } from '@react-email/components';
import { Button, EmailLayout } from '@repo/email';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import {
    formatTrialGreeting,
    trialSeriesStyles as styles,
    type TrialSeriesEmailProps
} from './trial-series-shared.js';

/**
 * Send 9 of 9 — sixty days after expiry, and the last email of the series
 * (HOS-1012 §4). Nothing is sent after this one.
 *
 * It says so explicitly. A series that simply stops leaves the host wondering
 * when the next one lands; saying "this is the last one" is what turns the end
 * of the series into a courtesy instead of an absence, and it is the only
 * honest way to ask for a decision without asking again next month.
 *
 * No commercial hook (OQ-1 open) — see `trial-win-back-1d.tsx`. A last-chance
 * discount would be the textbook place for one, which is exactly why it must
 * not be improvised here.
 *
 * @param props - Trial series email data
 */
export function TrialWinBack60Days({
    recipientName,
    upgradeUrl,
    verticals
}: TrialSeriesEmailProps) {
    return (
        <EmailLayout previewText="Último mail por tu prueba: tu ficha queda guardada igual">
            <Heading>Tu ficha sigue disponible cuando quieras</Heading>

            <Text style={styles.greeting}>{formatTrialGreeting({ recipientName })}</Text>
            {verticals && verticals.length > 1 ? (
                <Text style={styles.paragraph}>
                    Tu prueba incluye {formatTrialVerticals({ verticals })}.
                </Text>
            ) : null}

            <Text style={styles.paragraph}>
                Este es el último mail que te mandamos por tu prueba en Hospeda. No te vamos a
                seguir escribiendo por este tema.
            </Text>

            <Text style={styles.paragraph}>
                Tu publicación queda guardada en tu cuenta igual. El día que quieras volver a
                aparecer en el sitio, entrás, elegís un plan y vuelve online: no hace falta que
                avises antes ni que nos escribas para reactivarla.
            </Text>

            <Button
                href={upgradeUrl}
                variant="secondary"
            >
                Ver los planes
            </Button>

            <Text style={styles.footerNote}>
                Gracias por haber probado Hospeda. Ojalá nos crucemos de nuevo.
            </Text>
        </EmailLayout>
    );
}
