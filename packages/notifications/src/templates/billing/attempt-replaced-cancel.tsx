import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

export function AttemptReplacedCancel() {
    return (
        <EmailLayout previewText="Reemplazamos tu intento anterior">
            <Heading>Reemplazamos tu intento anterior</Heading>
            <Text>
                Volviste a empezar el alta o el cambio de plan, así que vamos a cancelar la
                autorización pendiente del intento anterior. Si Mercado Pago te avisa esa
                cancelación, es por esto. Ese intento no te cobró nada.
            </Text>
        </EmailLayout>
    );
}
