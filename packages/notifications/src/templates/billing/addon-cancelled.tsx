import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the notice sent before an orphaned addon's charge is cancelled. */
export const ADDON_CANCELLED_SUBJECT = 'Cancelamos el cobro de tu addon';

/**
 * The email that precedes cancelling the preapproval of a recurring addon whose
 * target is no longer active (A5 by orphanhood, AC:B5:27, DEC-MAIL-001): no
 * further charge, and Mercado Pago may send its own cancellation email.
 */
export function AddonCancelled() {
    return (
        <EmailLayout previewText={ADDON_CANCELLED_SUBJECT}>
            <Heading>{ADDON_CANCELLED_SUBJECT}</Heading>
            <Text>
                Lo que este addon complementaba ya no está activo, así que cancelamos su cobro. No
                se te va a volver a cobrar. Puede llegarte un correo de Mercado Pago avisando la
                cancelación.
            </Text>
        </EmailLayout>
    );
}
