import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the notice sent before a cancelled subscription's automatic charge is cancelled. */
export const SCHEDULED_CANCELLATION_SUBJECT = 'Cancelamos el cobro automático de tu suscripción';

/**
 * The email that precedes cancelling the preapproval of a subscription the person asked to
 * cancel (S11, and S12, which inherits S11's cancellation; kind `SCHEDULED_CANCELLATION`,
 * HOS-1683, AC:1683:2, DEC-MAIL-001): no further charge, the service runs to the end of the
 * paid period, and Mercado Pago may send its own cancellation email.
 */
export function ScheduledCancellation() {
    return (
        <EmailLayout previewText={SCHEDULED_CANCELLATION_SUBJECT}>
            <Heading>{SCHEDULED_CANCELLATION_SUBJECT}</Heading>
            <Text>
                Pediste la baja de tu suscripción, así que cancelamos su cobro automático: no se te
                va a volver a cobrar. El servicio sigue hasta el final del período que ya pagaste.
                Puede llegarte un correo de Mercado Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
