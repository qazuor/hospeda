import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the notice sent before a live authorization found on a closed subscription is cancelled. */
export const CLOSED_SUBSCRIPTION_AUTHORIZATION_CANCEL_SUBJECT =
    'Cancelamos una autorización de cobro que seguía activa';

/**
 * The email that precedes cancelling a preapproval Mercado Pago shows alive on a subscription
 * that is already closed (REJECTION_REVIVED; kind `LIVE_AUTHORIZATION_ON_CLOSED_ROW`, HOS-1683,
 * AC:1683:2, DEC-MAIL-001). It stays true on every closed state, so it says the subscription
 * no longer renews, not that it ended.
 */
export function ClosedSubscriptionAuthorizationCancel() {
    return (
        <EmailLayout previewText={CLOSED_SUBSCRIPTION_AUTHORIZATION_CANCEL_SUBJECT}>
            <Heading>{CLOSED_SUBSCRIPTION_AUTHORIZATION_CANCEL_SUBJECT}</Heading>
            <Text>
                Mercado Pago volvió a mostrar activa la autorización de cobro de una suscripción
                tuya que ya no se renueva. La cancelamos para que no se te haga ningún cobro más por
                ella. Puede llegarte un correo de Mercado Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
