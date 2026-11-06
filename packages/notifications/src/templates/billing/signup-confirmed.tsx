import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

export interface SignupConfirmedProps {
    /** User-facing plan name (never the internal catalog name). */
    readonly planName: string;
    /** Formatted amount of the first payment when it is already credited; `null` while still processing. */
    readonly firstPaymentAmount: string | null;
    /** Formatted date of the next charge, when known and in the future. */
    readonly nextChargeDate: string | null;
}

/**
 * Signup confirmation. Checkout is the paid path (HOS-1012), so the first charge
 * lands within minutes of the signup: the copy reports it as done when the
 * payment is already credited and as in-flight otherwise. It never announces a
 * first charge as a future event.
 */
export function SignupConfirmed({
    planName,
    firstPaymentAmount,
    nextChargeDate
}: SignupConfirmedProps) {
    return (
        <EmailLayout previewText="Tu suscripción ya está activa">
            <Heading>Tu suscripción está activa</Heading>
            {firstPaymentAmount ? (
                <>
                    <Text>
                        Tu suscripción a {planName} está activa. Ya cobramos el primer pago de{' '}
                        {firstPaymentAmount}.
                    </Text>
                    {nextChargeDate ? <Text>El próximo cobro es el {nextChargeDate}.</Text> : null}
                </>
            ) : (
                <>
                    <Text>Tu suscripción a {planName} está activa.</Text>
                    <Text>
                        Mercado Pago está procesando el primer cobro: en unos minutos te llega la
                        confirmación del pago.
                    </Text>
                </>
            )}
        </EmailLayout>
    );
}
