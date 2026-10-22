import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

export function AttemptCancelledCancel() {
    return (
        <EmailLayout previewText="Cancelamos tu intento de alta">
            <Heading>Cancelamos tu intento de alta</Heading>
            <Text>
                Cancelaste el intento de alta que tenías pendiente, así que vamos a cancelar su
                autorización en Mercado Pago. Si Mercado Pago te avisa esa cancelación, es por esto.
                Ese intento no te cobró nada.
            </Text>
        </EmailLayout>
    );
}
