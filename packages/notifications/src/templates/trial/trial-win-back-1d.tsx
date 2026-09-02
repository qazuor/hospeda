import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 5 of 9 — one day after expiry (HOS-1012 §4).
 *
 * The first win-back, and the one at most risk of reading as a repeat: it lands
 * a day after the expiry mail, which already said the listing came down. So it
 * does not re-explain that. Its job is narrower — the way back is one step, and
 * the step is still exactly where they left it.
 *
 * OQ-1 is OPEN: no discount, coupon or promo code appears here or in any of the
 * other four win-backs. Coupons are never published, and offering one by
 * directed email is a decision the owner has not made. If it is ever made, the
 * hook goes right below the CTA — deliberately left empty rather than stubbed.
 *
 * @param props - Trial series email data
 */
export function TrialWinBack1Day({ recipientName, planName, upgradeUrl }: TrialSeriesEmailProps) {
    return (
        <EmailLayout
            previewText="Tu ficha quedó lista; falta un paso para volver a verla online"
            showUnsubscribe={true}
        >
            <Heading>Tu publicación te está esperando</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Ayer tu alojamiento dejó de verse en Hospeda. Nada más que eso cambió: la
                publicación está entera, terminada, con todo lo que cargaste, esperando en tu
                cuenta.
            </Text>

            <Text style={styles.paragraph}>
                Volver es un solo paso. Elegís el plan {planName} —o el que te sirva mejor— y tu
                ficha vuelve a las búsquedas al instante.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Volver a publicar</Button>
            </Section>

            <Text style={styles.footerNote}>
                ¿Fue algo de la plataforma lo que te frenó? Respondé este mail y contanos qué pasó.
            </Text>
        </EmailLayout>
    );
}
