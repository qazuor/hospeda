import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the notice sent before an inherited Tourist VIP is cancelled. */
export const TOURIST_VIP_INHERITED_CANCEL_SUBJECT = 'Cancelamos tu suscripción a Turista VIP';

/**
 * The email that precedes cancelling a paid Tourist VIP subscription the user's
 * plan already grants (S2's clause and S7's, AC:B7:31, DEC-ENT-004): no further
 * charge and no refund of what was already paid.
 */
export function TouristVipInheritedCancel() {
    return (
        <EmailLayout previewText={TOURIST_VIP_INHERITED_CANCEL_SUBJECT}>
            <Heading>{TOURIST_VIP_INHERITED_CANCEL_SUBJECT}</Heading>
            <Text>
                Tu plan ya te da los beneficios de Turista VIP, así que cancelamos la suscripción
                que pagabas por separado. No se te va a volver a cobrar, y lo ya pagado no se
                reembolsa. Puede llegarte un correo de Mercado Pago avisando la cancelación.
            </Text>
        </EmailLayout>
    );
}
