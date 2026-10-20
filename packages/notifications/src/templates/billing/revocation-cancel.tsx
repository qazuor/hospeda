import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the notice sent before a revoked subscription's payment authorization is cancelled. */
export const REVOCATION_CANCEL_SUBJECT = 'Registramos la revocación de tu suscripción';

/**
 * The email that precedes cancelling the preapproval of a revoked subscription (S36; kind
 * `REVOCATION`, HOS-1683, AC:1683:2, DEC-MAIL-001): no further charge, the refund follows its
 * own process, and Mercado Pago may send its own cancellation email.
 */
export function RevocationCancel() {
    return (
        <EmailLayout previewText={REVOCATION_CANCEL_SUBJECT}>
            <Heading>{REVOCATION_CANCEL_SUBJECT}</Heading>
            <Text>
                Registramos la revocación que pediste: cancelamos tu suscripción y su autorización
                de cobro, así que no se te va a volver a cobrar. La devolución de tu último pago
                sigue su propio trámite. Puede llegarte un correo de Mercado Pago avisando la
                cancelación.
            </Text>
        </EmailLayout>
    );
}
