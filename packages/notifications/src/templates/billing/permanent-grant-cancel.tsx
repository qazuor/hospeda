import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the notice sent before S13 cancels a permanent grant subscription's authorization. */
export const PERMANENT_GRANT_CANCEL_SUBJECT = 'Tu suscripción ya no se cobra';

/**
 * S13's notice before cancelling the preapproval (kind `PERMANENT_GRANT`, HOS-1582,
 * DEC-MAIL-001). It explains that no further charge will be made and Mercado Pago may notify too.
 */
export function PermanentGrantCancel() {
    return (
        <EmailLayout previewText={PERMANENT_GRANT_CANCEL_SUBJECT}>
            <Heading>{PERMANENT_GRANT_CANCEL_SUBJECT}</Heading>
            <Text>
                Te otorgamos acceso permanente sin costo en Hospeda, así que cancelamos la
                autorización de cobro de tu suscripción: no se te va a volver a cobrar por ella.
                Puede llegarte un correo de Mercado Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
