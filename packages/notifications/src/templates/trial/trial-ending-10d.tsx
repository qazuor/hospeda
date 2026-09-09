import { Section, Text } from '@react-email/components';
import { resolveTrialSeriesCopy } from '../../utils/product-domain-copy.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';
import { trialSeriesStyles as styles, type TrialSeriesEmailProps } from './trial-series-shared.js';

/**
 * Send 1 of 9 — ten days before the trial ends (HOS-1012 §4).
 *
 * This one is NOT selling. Ten days out the host has time to spare, and the
 * useful thing to do is ask whether the listing is working for them and offer a
 * hand with it. The plan link is present but secondary and last; leading with
 * it here is what turns a helpful check-in into a nag, and the host still has
 * two more emails ahead of them that do name the deadline.
 *
 * @param props - Trial series email data
 */
export function TrialEnding10Days({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl,
    productDomain
}: TrialSeriesEmailProps) {
    const formattedEndDate = formatDate({ dateString: trialEndDate });
    const copy = resolveTrialSeriesCopy(productDomain);

    return (
        <EmailLayout
            previewText="¿Te está sirviendo tu publicación? Contanos cómo va"
            showUnsubscribe={true}
        >
            <Heading>¿Cómo venís con tu publicación?</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Hace unos días publicaste {copy.possessive} en Hospeda y queríamos saber cómo te
                está yendo. Esto no es un recordatorio de pago: todavía te quedan diez días de
                prueba y no hay nada que tengas que hacer hoy.
            </Text>

            <Section style={styles.calmBox}>
                <Text style={styles.paragraph}>
                    Tres cosas que suelen marcar la diferencia en las consultas que recibe una
                    ficha:
                </Text>
                <Text style={styles.paragraph}>
                    • Fotos con luz de día, empezando por la que mejor muestra el lugar.
                    <br />• {copy.descriptionTip}
                    <br />• {copy.detailsTip}
                </Text>
            </Section>

            <Text style={styles.paragraph}>
                Si algo no te cierra o no encontrás dónde se edita, respondé este mail y te damos
                una mano. Leemos todo.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button
                    href={upgradeUrl}
                    variant="secondary"
                >
                    Ver los planes
                </Button>
            </Section>

            <Text style={styles.footerNote}>
                Tu prueba gratis del plan {planName} termina el {formattedEndDate}. Te vamos a
                avisar antes.
            </Text>
        </EmailLayout>
    );
}
