import { Text } from '@react-email/components';
import { EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

export function AttemptCancelledCancel() {
    return (
        <EmailLayout previewText="Cancelamos tu intento pendiente">
            <Heading>Cancelamos tu intento pendiente</Heading>
            <Text>
                Cancelaste el alta o el cambio de plan que tenías pendiente, así que vamos a
                cancelar su autorización en Mercado Pago. Si Mercado Pago te avisa esa cancelación,
                es por esto. Ese intento no te cobró nada.
            </Text>
        </EmailLayout>
    );
}
