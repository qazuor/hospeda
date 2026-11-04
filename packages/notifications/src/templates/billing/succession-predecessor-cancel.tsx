import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the S17 notice sent before cancelling the predecessor authorization. */
export const SUCCESSION_PREDECESSOR_CANCEL_SUBJECT = 'Tu cambio de plan ya está activo';

/** AC:B8b:9: explains why the previous plan's authorization is cancelled. */
export function SuccessionPredecessorCancel() {
    return (
        <EmailLayout previewText={SUCCESSION_PREDECESSOR_CANCEL_SUBJECT}>
            <Heading>{SUCCESSION_PREDECESSOR_CANCEL_SUBJECT}</Heading>
            <Text>
                Tu nuevo plan ya está activo. Cancelamos la autorización de cobro de tu plan
                anterior para que no se te cobre dos veces. Puede llegarte un correo de Mercado Pago
                que habla de una cancelación: es parte del cambio que pediste.
            </Text>
        </EmailLayout>
    );
}
