import { Text } from '@react-email/components';
import type { SignupDeclinedCause, SignupDeclinedRetry } from '@repo/billing';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of S16's generic first-charge decline notice (HOS-1675, catalog row 19). */
export const SIGNUP_DECLINED_SUBJECT = 'No pudimos cobrar el primer pago de tu suscripción';

/**
 * HOS-1675 supplies the subject and generic notice; HOS-1618 adds measured
 * decline-cause and retry branches plus the conditional trial reminder.
 */
export function SignupDeclined({
    vertical,
    subscriptionUrl,
    cause,
    retry
}: {
    readonly vertical: string;
    readonly subscriptionUrl: string;
    readonly cause: SignupDeclinedCause;
    readonly retry: SignupDeclinedRetry;
}) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    const causeText: Record<SignupDeclinedCause, string | null> = {
        PROVIDER_RISK:
            'Mercado Pago lo rechazó por sus controles de seguridad, no por tu tarjeta: tu tarjeta está bien. Probá de nuevo más tarde, desde el dispositivo que solés usar para comprar en internet, o escribinos.',
        PAYMENT_METHOD:
            'Fue rechazado por un problema con el medio de pago. Revisá tu tarjeta (fondos, vencimiento y datos) o usá otra.',
        UNKNOWN: null
    };
    const retryText: Record<SignupDeclinedRetry, string> = {
        NEW_SIGNUP: 'Para volver a intentarlo, empezá un alta nueva.',
        FINISH_SUCCESSOR_CHECKOUT:
            'Ya tenés abierto el pago del plan que elegiste: terminalo desde Mi Suscripción. No hace falta empezar otra alta.'
    };
    const causeParagraph = causeText[cause];
    return (
        <EmailLayout previewText={SIGNUP_DECLINED_SUBJECT}>
            <Heading>{SIGNUP_DECLINED_SUBJECT}</Heading>
            <Text>
                El primer cobro de tu suscripción de {verticalName} fue rechazado, así que el alta
                no quedó hecha. No se te cobró nada.
            </Text>
            {causeParagraph && <Text>{causeParagraph}</Text>}
            <Text>{retryText[retry]}</Text>
            <Text>
                Si estabas en tu período de prueba en esta vertical, lo seguís teniendo con los días
                que te quedaban.
            </Text>
            <Text>
                En Mi Suscripción tenés los pasos para volver a intentarlo: {subscriptionUrl}
            </Text>
            <Text>Puede llegarte un correo de Mercado Pago avisando el rechazo.</Text>
        </EmailLayout>
    );
}
