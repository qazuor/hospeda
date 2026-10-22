import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

export function AttemptReplacedCancel() {
    return (
        <EmailLayout previewText="Reemplazamos tu intento de alta anterior">
            <Heading>Reemplazamos tu intento de alta anterior</Heading>
            <Text>
                Empezaste el alta de nuevo, así que vamos a cancelar la autorización pendiente del
                intento anterior. Si Mercado Pago te avisa esa cancelación, es por esto. Ese intento
                no te cobró nada.
            </Text>
        </EmailLayout>
    );
}
