import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the notice sent before S20 cancels a permanent-grant addon charge. */
export const PERMANENT_GRANT_ADDON_CANCEL_SUBJECT = 'Tu addon ya no se cobra';

/** S20 notice before cancelling an addon complement authorization (B9a, HOS-1583). */
export function PermanentGrantAddonCancel() {
    return (
        <EmailLayout previewText={PERMANENT_GRANT_ADDON_CANCEL_SUBJECT}>
            <Heading>{PERMANENT_GRANT_ADDON_CANCEL_SUBJECT}</Heading>
            <Text>
                Te otorgamos acceso permanente sin costo en Hospeda y tu addon queda incluido, así
                que cancelamos la autorización de cobro: no se te va a volver a cobrar por él y
                sigue funcionando. Puede llegarte un correo de Mercado Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
