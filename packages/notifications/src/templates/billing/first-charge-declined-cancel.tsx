import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the notice sent before the payment authorization of a signup whose first charge was declined is cancelled. */
export const FIRST_CHARGE_DECLINED_CANCEL_SUBJECT =
    'Cancelamos la autorización de cobro de tu alta';

/**
 * The email that precedes cancelling the preapproval of a signup whose first charge was
 * declined (S16, and S1 when it re-cancels that row; kind `FIRST_CHARGE_DECLINED`, HOS-1683,
 * AC:1683:2, DEC-MAIL-001): nothing is charged for the attempt, and Mercado Pago may send
 * its own cancellation email. Why it was declined is `billing.signup-declined`, not this one.
 */
export function FirstChargeDeclinedCancel() {
    return (
        <EmailLayout previewText={FIRST_CHARGE_DECLINED_CANCEL_SUBJECT}>
            <Heading>{FIRST_CHARGE_DECLINED_CANCEL_SUBJECT}</Heading>
            <Text>
                El primer cobro de tu suscripción fue rechazado, así que cancelamos su autorización
                de cobro. No se te va a cobrar nada por este intento. Puede llegarte un correo de
                Mercado Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
