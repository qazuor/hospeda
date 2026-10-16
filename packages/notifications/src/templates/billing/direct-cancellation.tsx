import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the notice sent before S23 or S24 cancels a subscription authorization. */
export const DIRECT_CANCELLATION_SUBJECT = 'Tu suscripción quedó cancelada';

/** S23/S24 notice before cancelling a subscription from SUSPENDED or GRACE_PERIOD. */
export function DirectCancellation() {
    return (
        <EmailLayout previewText={DIRECT_CANCELLATION_SUBJECT}>
            <Heading>{DIRECT_CANCELLATION_SUBJECT}</Heading>
            <Text>
                Diste de baja tu suscripción y el servicio terminó hoy. Cancelamos la autorización
                de cobro, así que no se te va a volver a cobrar. Puede llegarte un correo de Mercado
                Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
