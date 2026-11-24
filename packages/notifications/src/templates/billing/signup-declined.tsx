import { Text } from '@react-email/components';
import { Button, EmailLayout } from '@repo/email';
import type {
    SignupDeclinedCause,
    SignupDeclinedRetry
} from '../../services/outbox/signup-declined-reason.js';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';

/** Subject of S16's generic first-charge decline notice (HOS-1675, catalog row 19). */
export const SIGNUP_DECLINED_SUBJECT = 'No pudimos cobrar el primer pago de tu suscripción';

/**
 * HOS-1675 supplies the subject and generic notice; HOS-1618 adds measured
 * decline-cause and retry branches plus the conditional trial reminder.
 */
export function SignupDeclined({
    vertical,
    planName,
    subscriptionUrl,
    cause,
    retry
}: {
    readonly vertical: string;
    /** Display name of the plan the signup tried to buy; null for mails queued before HOS-2193. */
    readonly planName: string | null;
    readonly subscriptionUrl: string;
    readonly cause: SignupDeclinedCause;
    readonly retry: SignupDeclinedRetry;
}) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    // The tourist plan is named by its vertical label ("Turista VIP"): the vertical is not repeated.
    const subscriptionName = planName
        ? `${planName}${vertical === 'tourist' ? '' : ` (${verticalName})`}`
        : verticalName;
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
                El primer cobro de tu suscripción {planName ? 'al plan' : 'de'} {subscriptionName}{' '}
                fue rechazado, así que el alta no quedó hecha. No se te cobró nada.
            </Text>
            {causeParagraph && <Text>{causeParagraph}</Text>}
            <Text>{retryText[retry]}</Text>
            <Text>
                Si estabas en tu período de prueba en esta vertical, lo seguís teniendo con los días
                que te quedaban.
            </Text>
            <Text>En Mi Suscripción tenés los pasos para volver a intentarlo.</Text>
            <Button href={subscriptionUrl}>Volver a intentarlo</Button>
            <Text>Puede llegarte un correo de Mercado Pago avisando el rechazo.</Text>
        </EmailLayout>
    );
}
