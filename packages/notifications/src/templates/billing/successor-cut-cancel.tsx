import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the S31 notice sent before cancelling the successor authorization. */
export const SUCCESSOR_CUT_CANCEL_SUBJECT = 'Cortamos el cambio de plan que tenías en curso';

/** Explains why a chargeback also ended the pending plan change. */
export function SuccessorCutCancel() {
    return (
        <EmailLayout previewText={SUCCESSOR_CUT_CANCEL_SUBJECT}>
            <Heading>{SUCCESSOR_CUT_CANCEL_SUBJECT}</Heading>
            <Text>
                Registramos una disputa de pago sobre tu suscripción anterior. Por eso cancelamos
                también el cambio de plan que habías iniciado, para que no se te cobre. Puede
                llegarte un correo de Mercado Pago que habla de una cancelación: es parte de esto.
            </Text>
        </EmailLayout>
    );
}
