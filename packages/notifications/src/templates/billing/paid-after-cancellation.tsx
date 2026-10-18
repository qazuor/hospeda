import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the notice sent after payment on an already cancelled preapproval. */
export const PAID_AFTER_CANCELLATION_SUBJECT = 'Tu pago entró, pero tu suscripción no se renueva';

/** Tells the subscriber that the paid period is honored and the plan will not renew. */
export function PaidAfterCancellation({
    vertical,
    serviceEndDate,
    recurringAddonsCut,
    subscriptionUrl
}: {
    readonly vertical: string;
    readonly serviceEndDate: string;
    readonly recurringAddonsCut: boolean;
    readonly subscriptionUrl: string;
}) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    return (
        <EmailLayout previewText={PAID_AFTER_CANCELLATION_SUBJECT}>
            <Heading>{PAID_AFTER_CANCELLATION_SUBJECT}</Heading>
            <Text>
                Tu pago entró y tenés servicio hasta el {serviceEndDate}; tu suscripción ya estaba
                cancelada, así que no se renueva: si querés seguir, volvé a suscribirte.
            </Text>
            <Text>Tu suscripción de {verticalName}.</Text>
            {recurringAddonsCut ? (
                <Text>
                    El cobro de tus complementos recurrentes de esta suscripción también se cortó:
                    los seguís viendo hasta el {serviceEndDate}.
                </Text>
            ) : null}
            <Text>Mi Suscripción: {subscriptionUrl}</Text>
        </EmailLayout>
    );
}
