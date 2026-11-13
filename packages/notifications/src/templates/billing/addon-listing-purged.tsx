import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the notice before cancelling an addon whose listing was purged. */
export const ADDON_LISTING_PURGED_SUBJECT =
    'Cancelamos el cobro del addon de una ficha que borraste';

/** A6 notice sent before cancelling the consumed addon's preapproval. */
export function AddonListingPurged() {
    return (
        <EmailLayout previewText={ADDON_LISTING_PURGED_SUBJECT}>
            <Heading>{ADDON_LISTING_PURGED_SUBJECT}</Heading>
            <Text>
                Borraste una ficha que tenía un addon contratado. El addon se consumió con la ficha
                y cancelamos su cobro en Mercado Pago. Puede llegarte un correo de Mercado Pago
                avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
