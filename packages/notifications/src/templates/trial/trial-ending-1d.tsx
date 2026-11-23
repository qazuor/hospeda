import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { resolveTrialSeriesCopy } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { formatDate } from '../utils/index.js';
import {
    formatTrialGreeting,
    resolveTrialPlanName,
    trialSeriesStyles as styles,
    type TrialSeriesEmailProps
} from './trial-series-shared.js';

/**
 * Send 3 of 9 — the day before the trial ends (HOS-1012 §4).
 *
 * Direct, short, one thing to do. No tips, no check-in, no alternatives: this
 * is the last email that can still prevent the listing from coming down, and
 * anything else in it competes with that. The reassurance about the data being
 * kept stays, because the fear it answers is what makes people freeze rather
 * than decide.
 *
 * @param props - Trial series email data
 */
export function TrialEnding1Day({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl,
    productDomain
}: TrialSeriesEmailProps) {
    const plan = resolveTrialPlanName({ planName });
    const planFragment = plan ? (
        <>
            {' '}
            del plan <strong>{plan}</strong>
        </>
    ) : null;
    const formattedEndDate = formatDate({ dateString: trialEndDate });
    const copy = resolveTrialSeriesCopy(productDomain);

    return (
        <EmailLayout
            previewText="Mañana tu publicación deja de verse en Hospeda"
            footerLink="none"
        >
            <Heading>Mañana tu publicación sale del sitio</Heading>

            <Text style={styles.greeting}>{formatTrialGreeting({ recipientName })}</Text>

            <Callout tone="danger">
                <Text style={styles.paragraph}>
                    Mañana <strong>{formattedEndDate}</strong> termina tu prueba gratis
                    {planFragment}. Si no elegís un plan antes, {copy.possessive} deja de aparecer
                    en las búsquedas de Hospeda.
                </Text>
            </Callout>

            <Text style={styles.paragraph}>
                Elegir un plan lleva un par de minutos y tu ficha sigue online sin cortes.
            </Text>

            <Button href={upgradeUrl}>Elegir un plan ahora</Button>

            <Text style={styles.footerNote}>
                Si preferís dejarlo acá, no hace falta que hagas nada: guardamos tu publicación
                completa por si más adelante querés volver.
            </Text>
        </EmailLayout>
    );
}
